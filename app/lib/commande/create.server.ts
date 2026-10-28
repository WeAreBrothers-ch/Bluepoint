import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { success, type Result } from "../core/result";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { claimRequest, recordDraft, releaseRequest } from "./idempotency.server";
import { finishDraft } from "./finish.server";
import { MESSAGES, isPaymentTermsRefusal, netTermsWarning, refusalMessage, type PhoneOrderOutcome } from "./outcome";
import { buildDraftOrderInput, buildPaymentTerms, type PaymentTermsInput } from "./payload";
import { findPaymentTemplate, loadCustomerAddress } from "./reads.server";
import type { PhoneOrderInput, ShippingAddress } from "./types";
import { createDraftOrder } from "./writes.server";
import type { CreatedDraftOrderNode } from "./mutations";

/**
 * « Enregistrer la commande » : commande provisoire (draftOrderCreate) puis commande (draftOrderComplete).
 * Sur facture : conditions « net N jours ». À la livraison : conditions « à l'expédition ».
 * Dans les deux cas la commande reste à payer. Si Shopify refuse ces conditions, la provisoire
 * n'est PAS terminée : sans conditions, Shopify la marquerait payée.
 */

function failureOutcome(error: ShopifyGraphqlError): PhoneOrderOutcome {
  return error instanceof ShopifyUserErrors
    ? { kind: "erreur", message: refusalMessage(error.message) }
    : { kind: "erreur", message: MESSAGES.indisponible };
}

interface DraftAttempt {
  readonly draft: CreatedDraftOrderNode;
  readonly termsApplied: boolean;
}

/** Crée la provisoire avec les conditions ; si Shopify les refuse, la recrée sans. */
async function createDraft(
  admin: AdminApiContext,
  order: PhoneOrderInput,
  address: ShippingAddress | null,
  terms: PaymentTermsInput | null,
): Promise<Result<DraftAttempt, ShopifyGraphqlError>> {
  const first = await createDraftOrder(admin, buildDraftOrderInput(order, address, terms));
  if (first.ok) return success({ draft: first.value, termsApplied: terms !== null });
  const refusedTerms = terms !== null && first.error instanceof ShopifyUserErrors && isPaymentTermsRefusal(first.error.userErrors);
  if (!refusedTerms) return first;
  logError("Conditions de paiement refusées par Shopify : commande laissée provisoire", first.error);
  const retry = await createDraftOrder(admin, buildDraftOrderInput(order, address, null));
  return retry.ok ? success({ draft: retry.value, termsApplied: false }) : retry;
}

async function paymentTermsFor(admin: AdminApiContext, order: PhoneOrderInput, days: number) {
  if (order.payment === "paye") return { terms: null, warnings: [] };
  const chosen = await findPaymentTemplate(admin, order.payment, days);
  if (chosen === null) return { terms: null, warnings: [] };
  const warnings = chosen.exact ? [] : [netTermsWarning(days, chosen.template.dueInDays)];
  const issuedAt = order.payment === "facture" ? new Date() : null;
  return { terms: buildPaymentTerms(chosen.template.id, issuedAt), warnings };
}

async function createFresh(
  admin: AdminApiContext,
  order: PhoneOrderInput,
  paymentTermDays: number,
): Promise<PhoneOrderOutcome> {
  const key = order.idempotencyKey;
  const customer = await loadCustomerAddress(admin, order.customerId);
  if (!customer.ok || !customer.value.found) {
    await releaseRequest(key);
    return customer.ok
      ? { kind: "invalide", message: MESSAGES.invalide, errors: { customerId: "Ce client n’existe plus dans Shopify\u202F: choisissez-le à nouveau." } }
      : { kind: "erreur", message: MESSAGES.indisponible };
  }
  const { terms, warnings } = await paymentTermsFor(admin, order, paymentTermDays);
  const created = await createDraft(admin, order, customer.value.address, terms);
  if (!created.ok) {
    await releaseRequest(key);
    logError("Commande par téléphone refusée", created.error);
    return failureOutcome(created.error);
  }
  const { draft, termsApplied } = created.value;
  const leaveAsDraft = order.payment !== "paye" && !termsApplied;
  await recordDraft(key, {
    draftOrderId: draft.id,
    draftOrderName: draft.name,
    status: leaveAsDraft ? "brouillon" : "a_terminer",
    paymentPending: termsApplied,
  });
  logInfo("Commande provisoire créée (téléphone)", { draftOrderId: draft.id, termsApplied });
  if (leaveAsDraft) {
    return { kind: "brouillon", draftOrderId: draft.id, draftName: draft.name, message: MESSAGES.brouillonSansConditions };
  }
  return finishDraft(admin, order, { draftOrderId: draft.id, draftOrderName: draft.name, paymentPending: termsApplied }, warnings);
}

export async function createPhoneOrder(
  admin: AdminApiContext,
  shop: string,
  order: PhoneOrderInput,
  paymentTermDays: number,
): Promise<PhoneOrderOutcome> {
  const claim = await claimRequest(shop, order.idempotencyKey);
  switch (claim.kind) {
    case "nouvelle":
    case "reprendre":
      return createFresh(admin, order, paymentTermDays);
    case "en_cours":
      return { kind: "en_cours", message: MESSAGES.enCours };
    case "refusee":
      return { kind: "erreur", message: MESSAGES.recharger };
    case "brouillon":
      return { kind: "brouillon", draftOrderId: claim.draftOrderId, draftName: claim.draftOrderName, message: MESSAGES.brouillonSansConditions };
    case "deja_terminee":
      return {
        kind: "commande",
        orderId: claim.orderId,
        orderName: claim.orderName,
        paymentPending: claim.paymentPending,
        payment: order.payment,
        requestedDate: order.requestedDate,
        warnings: [],
        replayed: true,
      };
    case "terminer":
      return finishDraft(admin, order, claim, []);
  }
}
