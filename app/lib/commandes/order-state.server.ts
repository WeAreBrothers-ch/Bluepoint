import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { findInvoiceByOrder } from "../factures/repository.server";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { PAS_ENCORE_ACTIVE } from "../titres";
import { changeRules, type ChangeRules, type EditableLine, type OrderChangeResult } from "./change";

/** La commande telle que Shopify la voit juste avant un changement, et les réponses communes à « modifier » et « annuler ». */

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

export interface OrderStateNode {
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

export interface LoadedOrder {
  readonly node: OrderStateNode;
  readonly rules: ChangeRules;
  readonly lines: readonly EditableLine[];
}

export const RETRY = "Shopify ne répond pas pour le moment. Réessayez dans un instant\u202F: rien n’a été changé.";

export function refusal(intent: OrderChangeResult["intent"], message: string): OrderChangeResult {
  return { ok: false, intent, message };
}

export type Loaded = { readonly ok: true; readonly order: LoadedOrder } | { readonly ok: false; readonly message: string };

export async function loadOrder(admin: AdminApiContext, orderId: string): Promise<Loaded> {
  const result = await runAdminGraphql<{ readonly order: OrderStateNode | null }>(admin, ORDER_STATE_QUERY, { id: orderId });
  if (!result.ok) {
    logError("Commande illisible avant changement", result.error, { orderId });
    return { ok: false, message: RETRY };
  }
  const node = result.value.order;
  if (node === null) return { ok: false, message: "Cette commande n’existe plus." };
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

export function plainError(error: ShopifyGraphqlError): string {
  if (/access denied|access scope/i.test(error.message)) {
    return PAS_ENCORE_ACTIVE;
  }
  const detail = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  return detail ?? RETRY;
}
