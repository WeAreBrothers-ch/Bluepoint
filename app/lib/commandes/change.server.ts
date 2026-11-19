import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { isFullCartons } from "../commande/cart";
import { decimalToCents } from "../commande/totals";
import { logError, logInfo } from "../core/logger.server";
import { failure, type Result } from "../core/result";
import { formatChf } from "../format/money";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { cancelOrder } from "./cancel.server";
import {
  bottlesAfter,
  calculatedLineId,
  EMPTY_ORDER_MESSAGE,
  isEmptyPlan,
  isOrderChangeIntent,
  NOTHING_CHANGED_MESSAGE,
  parseWantedQuantities,
  type OrderChangeResult,
  type OrderEditPlan,
} from "./change";
import { HAND_LINES_FIELD, parseWantedHandLines, planWithHandLines } from "./hand-lines";
import { loadOrder, plainError, refusal } from "./order-state.server";

/**
 * Modifier les vins d'une commande pas encore livrée (Admin API, schéma 2026-10) : vins du catalogue et vins
 * écrits à la main. L'annulation est dans cancel.server.ts, l'état de la commande dans order-state.server.ts.
 */

export const ORDER_EDIT_SCOPE = "write_order_edits";

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
  const wantedHand = parseWantedHandLines(form.get(HAND_LINES_FIELD));
  if (wanted === null || wantedHand === null) return refusal("modifier", "Ça n’a pas marché. Rechargez la page, puis réessayez.");
  const loaded = await loadOrder(admin, orderId);
  if (!loaded.ok) return refusal("modifier", loaded.message);
  const { node, rules, lines } = loaded.order;
  if (!rules.canEdit) return refusal("modifier", rules.editBlocked ?? "Cette commande est déjà livrée ou annulée : elle ne peut plus être modifiée.");
  const plan = planWithHandLines(lines, wanted, wantedHand);
  if (isEmptyPlan(plan)) return { ok: true, intent: "modifier", message: NOTHING_CHANGED_MESSAGE };
  if (bottlesAfter(lines, plan) <= 0) return refusal("modifier", EMPTY_ORDER_MESSAGE);
  // Une ligne qu'on change doit être un nombre entier de cartons de 6 (une ancienne ligne laissée telle quelle reste permise).
  const changedQuantities = [...plan.set.map((entry) => entry.quantity), ...plan.add.map((entry) => entry.quantity)];
  if (changedQuantities.some((quantity) => quantity > 0 && !isFullCartons(quantity))) {
    return refusal("modifier", "Les vins se vendent par cartons de 6 bouteilles (6, 12, 18…). Corrigez la quantité, puis réessayez.");
  }
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

export async function handleOrderChange(admin: AdminApiContext, form: FormData): Promise<OrderChangeResult> {
  const intent = form.get("intent");
  const rawOrderId = form.get("orderId");
  const orderId = typeof rawOrderId === "string" ? parseGid(rawOrderId, "Order") : null;
  if (!isOrderChangeIntent(intent) || orderId === null) return refusal(null, "Ça n’a pas marché. Rechargez la page, puis réessayez.");
  return intent === "modifier" ? editOrder(admin, orderId, form) : cancelOrder(admin, orderId);
}
