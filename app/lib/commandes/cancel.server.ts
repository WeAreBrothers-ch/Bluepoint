import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { decimalToCents } from "../commande/totals";
import { formatChf } from "../format/money";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import type { OrderChangeResult } from "./change";
import { loadOrder, plainError, refusal } from "./order-state.server";

/** Annuler une commande pas encore livrée (Admin API, schéma 2026-10) : bouteilles remises en cave, client remboursé s'il a payé. */

const CANCEL_MUTATION = `#graphql
mutation AnnulerCommande($orderId: ID!, $refund: OrderCancelRefundMethodInput) {
  orderCancel(
    orderId: $orderId
    reason: CUSTOMER
    restock: true
    notifyCustomer: false
    refundMethod: $refund
    staffNote: "Annulée depuis l’app BluePoint"
  ) {
    job { id done }
    orderCancelUserErrors { field message code }
  }
}`;

const JOB_QUERY = `#graphql
query AnnulationTerminee($id: ID!) { job(id: $id) { done } }`;

interface CancelPayload {
  readonly job: { readonly id: string; readonly done: boolean } | null;
  readonly orderCancelUserErrors: readonly { readonly field: readonly string[] | null; readonly message: string; readonly code: string | null }[];
}

/** L'annulation est traitée par Shopify en arrière-plan : on attend un peu qu'elle soit finie. */
async function waitForJob(admin: AdminApiContext, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const job = await runAdminGraphql<{ readonly job: { readonly done: boolean } | null }>(admin, JOB_QUERY, { id: jobId });
    if (!job.ok || job.value.job === null || job.value.job.done) return;
  }
}

export async function cancelOrder(admin: AdminApiContext, orderId: string): Promise<OrderChangeResult> {
  const loaded = await loadOrder(admin, orderId);
  if (!loaded.ok) return refusal("annuler", loaded.message);
  const { node, rules } = loaded.order;
  if (!rules.changeable) return refusal("annuler", "Cette commande est déjà livrée, facturée ou annulée : elle ne peut plus être annulée ici.");
  const result = await runAdminGraphql<{ readonly orderCancel: CancelPayload | null }>(admin, CANCEL_MUTATION, {
    orderId,
    refund: rules.paid ? { originalPaymentMethodsRefund: true } : null,
  });
  if (!result.ok) {
    logError("Commande non annulée", result.error, { orderId });
    return refusal("annuler", plainError(result.error));
  }
  const payload = result.value.orderCancel;
  const errors = payload?.orderCancelUserErrors ?? [];
  if (payload === null || errors.length > 0) {
    const shopifyError = new ShopifyUserErrors(errors.length > 0 ? errors : [{ field: null, message: "Annulation sans réponse" }]);
    logError("Annulation refusée", shopifyError, { orderId });
    return refusal("annuler", plainError(shopifyError));
  }
  if (payload.job !== null && !payload.job.done) await waitForJob(admin, payload.job.id);
  const totalCents = decimalToCents(node.currentTotalPriceSet?.shopMoney.amount);
  logInfo("Commande annulée", { orderId, refunded: rules.paid });
  // Shopify ne rend l'argent tout seul que pour un paiement par carte ; un virement, des espèces ou TWINT se rendent à la main.
  const amount = totalCents === null ? "" : ` (${formatChf(totalCents)})`;
  const refund = rules.paid
    ? ` Le client avait payé${amount} : par carte sur le site, l’argent lui revient tout seul ; par virement, en espèces ou par TWINT, rendez-le-lui vous-même.`
    : "";
  return { ok: true, intent: "annuler", message: `Commande ${node.name} annulée. Les bouteilles sont remises en cave.${refund}` };
}
