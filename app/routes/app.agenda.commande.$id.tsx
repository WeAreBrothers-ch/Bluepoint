import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadOrderDetail, type OrderDetailResult } from "../lib/agenda/detail/load.server";
import { parseGid } from "../lib/shopify/ids";

/**
 * Détail d'une commande pour la fenêtre de l'agenda (appelé par un fetcher, sans page).
 * /app/agenda/commande/<numéro Shopify de la commande>
 */

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<OrderDetailResult> => {
  const { admin } = await authenticate.admin(request);
  const orderId = /^\d{1,20}$/.test(params["id"] ?? "") ? parseGid(`gid://shopify/Order/${params["id"]}`, "Order") : null;
  if (orderId === null) return { ok: false, message: "Commande introuvable." };
  return loadOrderDetail(admin, orderId);
};
