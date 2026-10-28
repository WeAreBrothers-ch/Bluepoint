import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { failure, type Result } from "../core/result";
import { findInvoiceByOrder } from "../factures/repository.server";
import { formatChf } from "../format/money";
import { decimalToCents } from "../commande/totals";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import {
  bottlesAfter,
  calculatedLineId,
  changeRules,
  EMPTY_ORDER_MESSAGE,
  isEmptyPlan,
  isOrderChangeIntent,
  NOTHING_CHANGED_MESSAGE,
  parseWantedQuantities,
  planOrderEdit,
  type ChangeRules,
  type EditableLine,
  type OrderChangeResult,
  type OrderEditPlan,
} from "./change";

/** Modifier les vins d'une commande pas encore livrée, ou l'annuler (Admin API, schéma 2026-10). */

export const ORDER_EDIT_SCOPE = "write_order_edits";

const ORDER_STATE_QUERY = `#graphql
query CommandeAvantChangement($id: ID!) {
  order(id: $id) {
    id
    name
    cancelledAt
    displayFinancialStatus
    displayFulfillmentStatus
    currentTotalPriceSet { shopMoney { amount } }
    lineItems(first: 100) { nodes { id currentQuantity variant { id } } }
  }
}`;

interface OrderStateNode {
  readonly id: string;
  readonly name: string;
  readonly cancelledAt: string | null;
  readonly displayFinancialStatus: string | null;
  readonly displayFulfillmentStatus: string | null;
  readonly currentTotalPriceSet: { readonly shopMoney: { readonly amount: string } } | null;
  readonly lineItems: {
    readonly nodes: readonly { readonly id: string; readonly currentQuantity: number; readonly variant: { readonly id: string } | null }[];
  };
}

const BEGIN_MUTATION = `#graphql
mutation DebutModification($id: ID!) {
  orderEditBegin(id: $id) {
    calculatedOrder { id lineItems(first: 100) { nodes { id variant { id } } } }
    userErrors { field message }
  }
}`;

const SET_QUANTITY_MUTATION = `#graphql
mutation ChangerQuantite($id: ID!, $lineItemId: ID!, $quantity: Int!) {
  orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity, restock: true) {
    calculatedOrder { id }
    userErrors { field message }
  }
}`;

const ADD_VARIANT_MUTATION = `#graphql
mutation AjouterVin($id: ID!, $variantId: ID!, $quantity: Int!) {
  orderEditAddVariant(id: $id, variantId: $variantId, quantity: $quantity, allowDuplicates: false) {
    calculatedOrder { id }
    userErrors { field message }
  }
}`;

const COMMIT_MUTATION = `#graphql
mutation EnregistrerModification($id: ID!) {
  orderEditCommit(id: $id, notifyCustomer: false, staffNote: "Vins modifiés depuis l’app BluePoint") {
    order { id currentTotalPriceSet { shopMoney { amount } } }
    userErrors { field message }
  }
}`;

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

interface CalculatedOrderPayload {
  readonly calculatedOrder: {
    readonly id: string;
    readonly lineItems?: { readonly nodes: readonly { readonly id: string; readonly variant: { readonly id: string } | null }[] };
  } | null;
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface CommitPayload {
  readonly order: { readonly id: string; readonly currentTotalPriceSet: { readonly shopMoney: { readonly amount: string } } | null } | null;
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface CancelPayload {
  readonly job: { readonly id: string; readonly done: boolean } | null;
  readonly orderCancelUserErrors: readonly { readonly field: readonly string[] | null; readonly message: string; readonly code: string | null }[];
}

interface LoadedOrder {
  readonly node: OrderStateNode;
  readonly rules: ChangeRules;
  readonly lines: readonly EditableLine[];
}

const RETRY = "Shopify ne répond pas pour le moment. Réessayez dans un instant\u202F: rien n’a été changé.";

function refusal(intent: OrderChangeResult["intent"], message: string): OrderChangeResult {
  return { ok: false, intent, message };
}

type Loaded = { readonly ok: true; readonly order: LoadedOrder } | { readonly ok: false; readonly message: string };

async function loadOrder(admin: AdminApiContext, orderId: string): Promise<Loaded> {
  const result = await runAdminGraphql<{ readonly order: OrderStateNode | null }>(admin, ORDER_STATE_QUERY, { id: orderId });
  if (!result.ok) {
    logError("Commande illisible avant changement", result.error, { orderId });
    return { ok: false, message: RETRY };
  }
  const node = result.value.order;
  if (node === null) return { ok: false, message: "Cette commande n’existe plus dans Shopify." };
  const invoice = await findInvoiceByOrder(orderId);
  const rules = changeRules({
    cancelled: node.cancelledAt !== null,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    hasInvoice: invoice !== null,
  });
  const lines = node.lineItems.nodes.map((line) => ({ lineItemId: line.id, variantId: line.variant?.id ?? null, quantity: line.currentQuantity }));
  return { ok: true, order: { node, rules, lines } };
}

function plainError(error: ShopifyGraphqlError): string {
  if (/access denied|access scope/i.test(error.message)) {
    return "L’app n’a pas encore le droit de modifier les commandes. Il faut d’abord faire l’étape d’autorisation dans Shopify.";
  }
  const detail = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  return detail ?? RETRY;
}

/** Applique les changements pendant une session de modification, puis l'enregistre. Rien n'est gardé en cas d'échec. */
async function applyEdit(admin: AdminApiContext, orderId: string, plan: OrderEditPlan): Promise<Result<CommitPayload, ShopifyGraphqlError>> {
  const begun = await runAdminMutation(admin, BEGIN_MUTATION, (data: { readonly orderEditBegin: CalculatedOrderPayload }) => data.orderEditBegin, { id: orderId });
  if (!begun.ok) return begun;
  const calculated = begun.value.calculatedOrder;
  if (calculated === null) return failure(new ShopifyUserErrors([{ field: null, message: "Modification impossible" }]));
  const calculatedIds = new Set(calculated.lineItems?.nodes.map((line) => line.id) ?? []);
  for (const entry of plan.set) {
    const lineItemId = calculatedLineId(entry.lineItemId);
    if (lineItemId === null || !calculatedIds.has(lineItemId)) {
      return failure(new ShopifyUserErrors([{ field: null, message: "Ligne de commande introuvable" }]));
    }
    const set = await runAdminMutation(admin, SET_QUANTITY_MUTATION, (data: { readonly orderEditSetQuantity: CalculatedOrderPayload }) => data.orderEditSetQuantity, {
      id: calculated.id,
      lineItemId,
      quantity: entry.quantity,
    });
    if (!set.ok) return set;
  }
  for (const entry of plan.add) {
    const added = await runAdminMutation(admin, ADD_VARIANT_MUTATION, (data: { readonly orderEditAddVariant: CalculatedOrderPayload }) => data.orderEditAddVariant, {
      id: calculated.id,
      variantId: entry.variantId,
      quantity: entry.quantity,
    });
    if (!added.ok) return added;
  }
  return runAdminMutation(admin, COMMIT_MUTATION, (data: { readonly orderEditCommit: CommitPayload }) => data.orderEditCommit, { id: calculated.id });
}

async function editOrder(admin: AdminApiContext, orderId: string, form: FormData): Promise<OrderChangeResult> {
  const wanted = parseWantedQuantities(form.get("quantities"));
  if (wanted === null) return refusal("modifier", "Ça n’a pas marché. Rechargez la page, puis réessayez.");
  const loaded = await loadOrder(admin, orderId);
  if (!loaded.ok) return refusal("modifier", loaded.message);
  const { node, rules, lines } = loaded.order;
  if (!rules.canEdit) return refusal("modifier", rules.editBlocked ?? "Cette commande est déjà livrée ou annulée : elle ne peut plus être modifiée.");
  const plan = planOrderEdit(lines, wanted);
  if (isEmptyPlan(plan)) return { ok: true, intent: "modifier", message: NOTHING_CHANGED_MESSAGE };
  if (bottlesAfter(lines, plan) <= 0) return refusal("modifier", EMPTY_ORDER_MESSAGE);
  const committed = await applyEdit(admin, orderId, plan);
  if (!committed.ok) {
    logError("Commande non modifiée", committed.error, { orderId });
    return refusal("modifier", plainError(committed.error));
  }
  const totalCents = decimalToCents(committed.value.order?.currentTotalPriceSet?.shopMoney.amount);
  logInfo("Commande modifiée", { orderId, set: plan.set.length, add: plan.add.length });
  const total = totalCents === null ? "" : ` Nouveau total\u202F: ${formatChf(totalCents)}.`;
  return { ok: true, intent: "modifier", message: `C’est noté\u202F: la commande ${node.name} est modifiée.${total}` };
}

/** L'annulation est traitée par Shopify en arrière-plan : on attend un peu qu'elle soit finie. */
async function waitForJob(admin: AdminApiContext, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const job = await runAdminGraphql<{ readonly job: { readonly done: boolean } | null }>(admin, JOB_QUERY, { id: jobId });
    if (!job.ok || job.value.job === null || job.value.job.done) return;
  }
}

async function cancelOrder(admin: AdminApiContext, orderId: string): Promise<OrderChangeResult> {
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
  const refund = rules.paid ? ` Le client sera remboursé${totalCents === null ? "" : ` de ${formatChf(totalCents)}`}.` : "";
  return { ok: true, intent: "annuler", message: `Commande ${node.name} annulée. Les bouteilles sont remises en stock.${refund}` };
}

export async function handleOrderChange(admin: AdminApiContext, form: FormData): Promise<OrderChangeResult> {
  const intent = form.get("intent");
  const rawOrderId = form.get("orderId");
  const orderId = typeof rawOrderId === "string" ? parseGid(rawOrderId, "Order") : null;
  if (!isOrderChangeIntent(intent) || orderId === null) return refusal(null, "Ça n’a pas marché. Rechargez la page, puis réessayez.");
  return intent === "modifier" ? editOrder(admin, orderId, form) : cancelOrder(admin, orderId);
}
