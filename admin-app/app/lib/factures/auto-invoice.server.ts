import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { loadStoredSettings } from "../reglages/settings.server";
import type { OrderGid } from "../shopify/ids";
import { ensureInvoice } from "./generate.server";

/**
 * Facture automatique à la création d'une expédition (webhook fulfillments/create),
 * seulement si le réglage « autoInvoiceOnDelivery » est activé. Idempotent : Shopify
 * peut renvoyer le même webhook, et une commande n'a jamais qu'une facture (orderId unique).
 */
export async function autoInvoiceOnFulfillment(admin: AdminApiContext, shop: string, orderId: OrderGid): Promise<void> {
  const settings = await loadStoredSettings(shop);
  if (settings?.autoInvoiceOnDelivery !== true) return;
  const result = await ensureInvoice(admin, shop, orderId);
  if (result.ok) {
    logInfo("Facture automatique", { orderId, number: result.value.invoice.number, created: result.value.created });
    return;
  }
  logError("Facture automatique non créée", result.error, { orderId, code: result.error.code });
}
