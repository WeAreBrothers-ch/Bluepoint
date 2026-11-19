import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { waitUntil } from "@vercel/functions";
import { logError, logInfo } from "../core/logger.server";
import type { OrderGid } from "../shopify/ids";
import { createSaleNoteForOrder } from "./vente-bon.server";
import { cancelSaleNote } from "./vente-bon-suivi.server";

/**
 * Le bon se fait (ou s'annule) APRÈS la réponse au webhook : Shopify attend une réponse rapide, AbaNinja
 * peut prendre plusieurs secondes. La plateforme garde la fonction en vie jusqu'à la fin ; une erreur est
 * journalisée, jamais relancée (la fiche commande dit alors où en est le bon).
 */

function runAfterResponse(work: () => Promise<{ readonly kind: string }>, done: string, failed: string, orderId: OrderGid): void {
  const task = work()
    .then((outcome) => {
      logInfo(done, { orderId, outcome: outcome.kind });
    })
    .catch((error: unknown) => {
      logError(failed, error, { orderId });
    });
  waitUntil(task);
}

export function scheduleSaleNote(admin: AdminApiContext, shop: string, orderId: OrderGid): void {
  runAfterResponse(() => createSaleNoteForOrder(admin, shop, orderId), "Bon de livraison AbaNinja à l’arrivée de la commande", "Bon de livraison AbaNinja non fait", orderId);
}

export function scheduleSaleNoteCancel(shop: string, orderId: OrderGid): void {
  runAfterResponse(() => cancelSaleNote(shop, orderId), "Bon de livraison AbaNinja à l’annulation de la commande", "Bon de livraison AbaNinja non annulé", orderId);
}
