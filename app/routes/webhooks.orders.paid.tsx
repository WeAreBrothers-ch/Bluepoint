import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logError, logInfo } from "../lib/core/logger.server";
import { issueReceiptOnPayment } from "../lib/factures/receipt.server";
import { readOrderPaid } from "../lib/webhooks/payloads";

/**
 * Commande payée : reçu pro automatique pour les professionnels. On répond toujours 200 :
 * une erreur est journalisée, et le reçu reste possible à la main depuis « Factures ».
 */
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  try {
    const orderId = readOrderPaid(payload);
    if (orderId === null) {
      logError("Webhook orders/paid illisible", new Error("Charge utile inattendue"), { shop });
      return new Response(null, { status: 200 });
    }
    logInfo("Webhook reçu", { topic, shop, orderId });
    if (admin === undefined) {
      logError("Webhook sans session : reçu pro impossible", new Error("Session absente"), { shop });
      return new Response(null, { status: 200 });
    }
    await issueReceiptOnPayment(admin, shop, orderId);
  } catch (error) {
    logError("Échec du traitement du webhook orders/paid", error, { shop });
  }
  return new Response(null, { status: 200 });
};
