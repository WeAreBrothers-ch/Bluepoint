import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { scheduleSaleNote } from "../lib/abaninja/vente-bon-schedule.server";
import { logError, logInfo } from "../lib/core/logger.server";
import { copyCartDeliveryToMetafields } from "../lib/webhooks/cart-delivery.server";
import { readOrderCreated } from "../lib/webhooks/payloads";

/**
 * Nouvelle commande : les attributs de livraison du panier (date souhaitée, date limite, mode)
 * sont recopiés dans les métachamps `$app` pour l'agenda et les filtres de l'admin. Ensuite, une
 * commande d'essai reçoit son bon de livraison AbaNinja, fait après la réponse (jour prévu déjà copié).
 * Réponse 200 rapide ; 500 seulement si Shopify n'a pas répondu, pour qu'il renvoie
 * le webhook (le traitement est idempotent, le bon ne se fait qu'une fois).
 */
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  // Signature HMAC invalide : la librairie lance une réponse 401, qu'on laisse remonter.
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  try {
    const order = readOrderCreated(payload);
    if (order === null) {
      logError("Webhook orders/create illisible", new Error("Charge utile inattendue"), { shop });
      return new Response(null, { status: 200 });
    }
    logInfo("Webhook reçu", { topic, shop, order: order.name });
    if (admin === undefined) {
      logError("Webhook sans session : métachamps livraison non copiés", new Error("Session absente"), { shop });
      return new Response(null, { status: 200 });
    }
    const outcome = await copyCartDeliveryToMetafields(admin, order.orderId, order.noteAttributes);
    if (outcome === "a_reessayer") return new Response(null, { status: 500 });
    scheduleSaleNote(admin, shop, order.orderId);
    return new Response(null, { status: 200 });
  } catch (error) {
    logError("Échec du traitement du webhook orders/create", error, { shop });
    return new Response(null, { status: 200 });
  }
};
