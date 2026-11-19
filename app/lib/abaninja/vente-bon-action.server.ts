import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { parseGid } from "../shopify/ids";
import { createSaleNoteForOrder } from "./vente-bon.server";
import { saleNoteActionResult, SALE_NOTE_INTENT, type SaleNoteActionResult } from "./vente-bon-view";

/** Bouton « Créer le bon de livraison » de la fiche commande : jamais d'exception, toujours une phrase pour Eliott. */

export function isSaleNoteIntent(value: unknown): value is typeof SALE_NOTE_INTENT {
  return value === SALE_NOTE_INTENT;
}

export async function handleSaleNoteAction(admin: AdminApiContext, shop: string, form: FormData): Promise<SaleNoteActionResult> {
  const raw = form.get("orderId");
  const orderId = typeof raw === "string" ? parseGid(raw, "Order") : null;
  if (orderId === null) return { intent: SALE_NOTE_INTENT, ok: false, message: "Cette commande n’existe pas." };
  try {
    return saleNoteActionResult(await createSaleNoteForOrder(admin, shop, orderId));
  } catch (error) {
    logError("Bouton « Créer le bon de livraison » : échec", error, { orderId });
    return { intent: SALE_NOTE_INTENT, ok: false, message: "Le bon de livraison n’a pas pu être fait. Réessayez dans un instant." };
  }
}
