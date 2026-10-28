import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { LIVRAISON_KEYS } from "../metafields/definitions";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import type { OrderGid } from "../shopify/ids";
import { setMetafields } from "../commande/writes.server";
import { metafieldsToSet, readCartDelivery, type ExistingDeliveryMetafields } from "./cart-delivery";
import type { NoteAttribute } from "./payloads";

/**
 * Webhook orders/create : attributs du panier → métachamps `$app` de la commande.
 * Idempotent : Shopify peut renvoyer le webhook ; un métachamp déjà posé n'est jamais réécrit.
 * Renvoie « a_reessayer » si Shopify n'a pas répondu : le webhook répond alors en erreur
 * pour que Shopify le renvoie plus tard.
 */

export type CopyOutcome = "fait" | "rien_a_faire" | "a_reessayer";

/** Requête vérifiée sur le schéma Admin 2026-10. */
export const ORDER_DELIVERY_METAFIELDS_QUERY = `#graphql
query MetachampsLivraisonCommande($id: ID!) {
  order(id: $id) {
    id
    dateSouhaitee: metafield(namespace: "$app", key: "livraison_date_souhaitee") { value }
    dateLimite: metafield(namespace: "$app", key: "livraison_date_limite") { value }
    mode: metafield(namespace: "$app", key: "livraison_mode") { value }
  }
}`;

interface MetafieldValue {
  readonly value: string;
}

interface OrderDeliveryMetafieldsData {
  readonly order: {
    readonly id: string;
    readonly dateSouhaitee: MetafieldValue | null;
    readonly dateLimite: MetafieldValue | null;
    readonly mode: MetafieldValue | null;
  } | null;
}

function existingFrom(order: NonNullable<OrderDeliveryMetafieldsData["order"]>): ExistingDeliveryMetafields {
  return {
    [LIVRAISON_KEYS.dateSouhaitee]: order.dateSouhaitee !== null,
    [LIVRAISON_KEYS.dateLimite]: order.dateLimite !== null,
    [LIVRAISON_KEYS.mode]: order.mode !== null,
  };
}

export async function copyCartDeliveryToMetafields(
  admin: AdminApiContext,
  orderId: OrderGid,
  attributes: readonly NoteAttribute[],
): Promise<CopyOutcome> {
  const delivery = readCartDelivery(attributes);
  for (const ignored of delivery.ignored) {
    // Ni la valeur ni le client ne sont journalisés : seulement l'attribut et la raison.
    logInfo("Attribut de livraison ignoré", { orderId, attribute: ignored.attribute, reason: ignored.reason });
  }
  if (delivery.requestedDate === null && delivery.deadline === null && delivery.mode === null) return "rien_a_faire";

  const state = await runAdminGraphql<OrderDeliveryMetafieldsData>(admin, ORDER_DELIVERY_METAFIELDS_QUERY, { id: orderId });
  if (!state.ok) {
    logError("Métachamps livraison illisibles", state.error, { orderId });
    return "a_reessayer";
  }
  if (state.value.order === null) {
    logError("Commande introuvable pour les métachamps livraison", new Error("Commande absente"), { orderId });
    return "rien_a_faire";
  }
  const metafields = metafieldsToSet(orderId, delivery, existingFrom(state.value.order));
  if (metafields.length === 0) return "rien_a_faire";
  const result = await setMetafields(admin, metafields);
  if (!result.ok) {
    logError("Métachamps livraison non posés depuis le panier", result.error, { orderId });
    // Refus de Shopify (valeur rejetée) : inutile de réessayer. Panne : Shopify renverra le webhook.
    return result.error instanceof ShopifyUserErrors ? "rien_a_faire" : "a_reessayer";
  }
  logInfo("Métachamps livraison posés depuis le panier", { orderId, count: metafields.length });
  return "fait";
}
