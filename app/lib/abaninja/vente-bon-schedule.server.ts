import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { waitUntil } from "@vercel/functions";
import { logError, logInfo } from "../core/logger.server";
import type { OrderGid } from "../shopify/ids";
import { createSaleNoteForOrder, type SaleNoteOutcome } from "./vente-bon.server";

/**
 * Le bon se fait APRÈS la réponse au webhook : Shopify attend une réponse rapide, AbaNinja peut prendre
 * plusieurs secondes. La plateforme garde la fonction en vie jusqu'à la fin ; une erreur est journalisée,
 * jamais relancée (la fiche commande propose alors « Créer le bon de livraison »).
 */
export function scheduleSaleNote(admin: AdminApiContext, shop: string, orderId: OrderGid): void {
  const work = createSaleNoteForOrder(admin, shop, orderId)
    .then((outcome: SaleNoteOutcome) => {
      logInfo("Bon de livraison AbaNinja à l’arrivée de la commande", { orderId, outcome: outcome.kind });
    })
    .catch((error: unknown) => {
      logError("Bon de livraison AbaNinja non fait", error, { orderId });
    });
  waitUntil(work);
}
