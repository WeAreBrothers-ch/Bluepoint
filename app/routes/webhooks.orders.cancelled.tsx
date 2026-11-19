import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { scheduleSaleNoteCancel } from "../lib/abaninja/vente-bon-schedule.server";
import { logError, logInfo } from "../lib/core/logger.server";
import { readOrderCancelled } from "../lib/webhooks/payloads";

/**
 * Commande annulée (dans l'app ou dans l'admin Shopify) : son bon de livraison AbaNinja est annulé, après
 * la réponse. On répond toujours 200 : l'annulation est rejouable et une erreur est journalisée.
 */
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  try {
    const orderId = readOrderCancelled(payload);
    if (orderId === null) {
      logError("Webhook orders/cancelled illisible", new Error("Charge utile inattendue"), { shop });
      return new Response(null, { status: 200 });
    }
    logInfo("Webhook reçu", { topic, shop, orderId });
    scheduleSaleNoteCancel(shop, orderId);
  } catch (error) {
    logError("Échec du traitement du webhook orders/cancelled", error, { shop });
  }
  return new Response(null, { status: 200 });
};
