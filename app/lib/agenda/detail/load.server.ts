import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../../core/logger.server";
import { runAdminGraphql } from "../../shopify/graphql.server";
import type { OrderGid } from "../../shopify/ids";
import { toOrderDetail, type OrderDetail } from "./mapping";
import { DETAIL_MAX_LINES, ORDER_DETAIL_QUERY, type OrderDetailData } from "./query";

/** Réponse envoyée à la fenêtre de détail : le détail, ou un message à afficher. */
export type OrderDetailResult =
  | { readonly ok: true; readonly detail: OrderDetail }
  | { readonly ok: false; readonly message: string };

export async function loadOrderDetail(admin: AdminApiContext, orderId: OrderGid): Promise<OrderDetailResult> {
  const result = await runAdminGraphql<OrderDetailData>(admin, ORDER_DETAIL_QUERY, { id: orderId, lines: DETAIL_MAX_LINES });
  if (!result.ok) {
    logError("Détail de commande illisible", result.error, { orderId });
    return { ok: false, message: "Shopify ne répond pas. Fermez et rouvrez le détail pour réessayer." };
  }
  if (result.value.order === null) return { ok: false, message: "Cette commande n’existe plus dans Shopify." };
  return { ok: true, detail: toOrderDetail(result.value.order) };
}
