import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import { swissIsoDate } from "../agenda/dates";
import {
  EARLY_PAYMENT_DESCRIPTION,
  EARLY_PAYMENT_PERCENT,
  EARLY_PAYMENT_TAG,
  earlyPaymentOffer,
  type EarlyPaymentOffer,
} from "../escompte/early-payment";
import { formatChf } from "../format/money";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { markOrderPaid } from "./payment.server";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./payment";
import type { Invoice } from "./repository.server";

/**
 * Encaisser une facture avec le rabais de paiement rapide : la commande Shopify est d'abord ajustée
 * (remise de 2 % sur chaque ligne, TVA recalculée par Shopify), puis marquée payée du nouveau montant.
 * Vérifié sur le schéma Admin 2026-10 : 229.50 → 224.91 et 1096.50 → 1074.57 (exactement 2 % de moins).
 */

const ORDER_STATE_QUERY = `#graphql
query EtatCommande($id: ID!) {
  order(id: $id) { id tags displayFinancialStatus }
}`;

const BEGIN_MUTATION = `#graphql
mutation RabaisDebut($id: ID!) {
  orderEditBegin(id: $id) {
    calculatedOrder { id lineItems(first: 100) { nodes { id quantity } } }
    userErrors { field message }
  }
}`;

const DISCOUNT_MUTATION = `#graphql
mutation RabaisLigne($id: ID!, $lineItemId: ID!, $discount: OrderEditAppliedDiscountInput!) {
  orderEditAddLineItemDiscount(id: $id, lineItemId: $lineItemId, discount: $discount) {
    calculatedOrder { id }
    userErrors { field message }
  }
}`;

const COMMIT_MUTATION = `#graphql
mutation RabaisValider($id: ID!, $note: String) {
  orderEditCommit(id: $id, notifyCustomer: false, staffNote: $note) {
    order { id }
    userErrors { field message }
  }
}`;

const TAGS_MUTATION = `#graphql
mutation RabaisEtiquette($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
}`;

interface UserErrors {
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}
interface OrderStateData {
  readonly order: { readonly id: string; readonly tags: readonly string[]; readonly displayFinancialStatus: string | null } | null;
}
interface BeginPayload extends UserErrors {
  readonly calculatedOrder: { readonly id: string; readonly lineItems: { readonly nodes: readonly { readonly id: string; readonly quantity: number }[] } } | null;
}
interface DiscountPayload extends UserErrors {
  readonly calculatedOrder: { readonly id: string } | null;
}
interface CommitPayload extends UserErrors {
  readonly order: { readonly id: string } | null;
}
interface TagsPayload extends UserErrors {}

export class EarlyPaymentError extends Error {
  override readonly name = "EarlyPaymentError";
}

const FAILED = "Le rabais n’a pas pu être appliqué à la commande. Rien n’a changé : réessayez, ou notez le montant complet.";

function explain(error: unknown): EarlyPaymentError {
  const plain = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  return new EarlyPaymentError(plain ?? FAILED);
}

/** Ajoute la remise sur chaque ligne puis valide : tout ou rien (rien n'est enregistré avant la validation). */
async function discountOrder(admin: AdminApiContext, orderId: string): Promise<Result<true, EarlyPaymentError>> {
  const begun = await runAdminMutation(admin, BEGIN_MUTATION, (data: { readonly orderEditBegin: BeginPayload | null }) => data.orderEditBegin, { id: orderId });
  if (!begun.ok) return failure(explain(begun.error));
  const calculated = begun.value.calculatedOrder;
  if (calculated === null) return failure(new EarlyPaymentError(FAILED));
  const lines = calculated.lineItems.nodes.filter((line) => line.quantity > 0);
  if (lines.length === 0) return failure(new EarlyPaymentError(FAILED));
  for (const line of lines) {
    const added = await runAdminMutation(
      admin,
      DISCOUNT_MUTATION,
      (data: { readonly orderEditAddLineItemDiscount: DiscountPayload | null }) => data.orderEditAddLineItemDiscount,
      { id: calculated.id, lineItemId: line.id, discount: { description: EARLY_PAYMENT_DESCRIPTION, percentValue: EARLY_PAYMENT_PERCENT } },
    );
    if (!added.ok) return failure(explain(added.error));
  }
  const committed = await runAdminMutation(admin, COMMIT_MUTATION, (data: { readonly orderEditCommit: CommitPayload | null }) => data.orderEditCommit, {
    id: calculated.id,
    note: `${EARLY_PAYMENT_DESCRIPTION} (facture payée dans les délais, appliqué depuis l’app BluePoint)`,
  });
  return committed.ok ? success(true) : failure(explain(committed.error));
}

export interface EarlyPaymentSuccess {
  readonly offer: EarlyPaymentOffer;
  readonly message: string;
}

/**
 * « Le client a payé avec le rabais » : vérifie que le rabais est encore valable, ajuste la commande,
 * la marque payée, et note le moyen de paiement. Idempotent : une étiquette empêche de remettre le rabais deux fois.
 */
export async function payWithEarlyDiscount(
  admin: AdminApiContext,
  invoice: Invoice,
  method: PaymentMethod,
  now: Date,
): Promise<Result<EarlyPaymentSuccess, EarlyPaymentError>> {
  const offer = earlyPaymentOffer(invoice, swissIsoDate(now));
  if (offer === null) {
    return failure(new EarlyPaymentError("Le rabais de paiement rapide n’est plus valable pour cette facture (10 jours après la date de facture). Notez le montant complet."));
  }
  const state = await runAdminGraphql<OrderStateData>(admin, ORDER_STATE_QUERY, { id: invoice.orderId });
  if (!state.ok || state.value.order === null) {
    logError("Commande illisible avant le rabais", state.ok ? new Error("commande introuvable") : state.error, { orderId: invoice.orderId });
    return failure(new EarlyPaymentError("La commande n’a pas pu être lue dans Shopify. Réessayez dans un instant."));
  }
  const order = state.value.order;
  if (order.displayFinancialStatus === "PAID") return failure(new EarlyPaymentError("Cette commande est déjà notée payée. Rechargez la page."));

  if (!order.tags.includes(EARLY_PAYMENT_TAG)) {
    const discounted = await discountOrder(admin, invoice.orderId);
    if (!discounted.ok) {
      logError("Rabais de paiement rapide non appliqué", discounted.error, { orderId: invoice.orderId });
      return discounted;
    }
    const tagged = await runAdminMutation(admin, TAGS_MUTATION, (data: { readonly tagsAdd: TagsPayload | null }) => data.tagsAdd, {
      id: invoice.orderId,
      tags: [EARLY_PAYMENT_TAG],
    });
    if (!tagged.ok) logError("Étiquette du rabais non posée", tagged.error, { orderId: invoice.orderId });
  }

  const paid = await markOrderPaid(admin, invoice.orderId, method);
  if (!paid.ok) {
    logError("Rabais appliqué mais paiement non noté", paid.error, { orderId: invoice.orderId });
    return failure(new EarlyPaymentError("Le rabais est appliqué, mais le paiement n’a pas pu être noté. Touchez « Le client a payé » une nouvelle fois : le rabais ne sera pas compté deux fois."));
  }
  logInfo("Facture encaissée avec le rabais de paiement rapide", { orderId: invoice.orderId, cents: offer.amountCents });
  return success({
    offer,
    message: `C’est noté\u202F: facture ${invoice.number} payée avec le rabais de ${offer.percent}\u202F% (${formatChf(offer.amountCents)}, ${PAYMENT_METHOD_LABELS[method]}).`,
  });
}
