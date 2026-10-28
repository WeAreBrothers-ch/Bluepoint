import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logError, logInfo } from "../lib/core/logger.server";
import { autoInvoiceOnFulfillment } from "../lib/factures/auto-invoice.server";
import { readFulfillmentCreated } from "../lib/webhooks/payloads";

/**
 * Expédition créée (dans l'app ou dans l'admin Shopify) : facture automatique si le réglage
 * est activé. On répond toujours 200 : une erreur est journalisée, et la facture reste
 * possible à la main depuis l'agenda.
 */
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  try {
    const fulfillment = readFulfillmentCreated(payload);
    if (fulfillment === null || fulfillment.orderId === null) {
      logError("Webhook fulfillments/create illisible", new Error("Charge utile inattendue"), { shop });
      return new Response(null, { status: 200 });
    }
    logInfo("Webhook reçu", { topic, shop, fulfillment: fulfillment.fulfillmentId });
    if (admin === undefined) {
      logError("Webhook sans session : facture automatique impossible", new Error("Session absente"), { shop });
      return new Response(null, { status: 200 });
    }
    await autoInvoiceOnFulfillment(admin, shop, fulfillment.orderId);
  } catch (error) {
    logError("Échec du traitement du webhook fulfillments/create", error, { shop });
  }
  return new Response(null, { status: 200 });
};
