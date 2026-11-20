import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { LIVRAISON_KEYS } from "../metafields/definitions";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import type { OrderGid } from "../shopify/ids";
import { setMetafields } from "../commande/writes.server";
import { metafieldsToSet, readCartDelivery, type CartDelivery, type ExistingDeliveryMetafields } from "./cart-delivery";
import { chooseDeliveryMode, readCheckoutDelivery } from "./checkout-delivery";
import type { NoteAttribute } from "./payloads";

/**
 * Webhook orders/create : attributs du panier (pros) et choix fait au paiement (retrait ou envoi)
 * → métachamps `$app` de la commande, pour l'agenda et les filtres.
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
    fulfillmentOrders(first: 10) { nodes { deliveryMethod { methodType } } }
  }
}`;

interface MetafieldValue {
  readonly value: string;
}

interface OrderDeliveryState {
  readonly id: string;
  readonly dateSouhaitee: MetafieldValue | null;
  readonly dateLimite: MetafieldValue | null;
  readonly mode: MetafieldValue | null;
  readonly fulfillmentOrders: { readonly nodes: readonly { readonly deliveryMethod: { readonly methodType: string } | null }[] };
}

interface OrderDeliveryMetafieldsData {
  readonly order: OrderDeliveryState | null;
}

function existingFrom(order: OrderDeliveryState): ExistingDeliveryMetafields {
  return {
    [LIVRAISON_KEYS.dateSouhaitee]: order.dateSouhaitee !== null,
    [LIVRAISON_KEYS.dateLimite]: order.dateLimite !== null,
    [LIVRAISON_KEYS.mode]: order.mode !== null,
  };
}

/** Le mode du panier, complété ou corrigé par le choix fait au paiement. */
function withCheckoutMode(orderId: OrderGid, cart: CartDelivery, order: OrderDeliveryState): CartDelivery {
  const methodTypes = order.fulfillmentOrders.nodes.flatMap((node) => (node.deliveryMethod === null ? [] : [node.deliveryMethod.methodType]));
  const checkout = readCheckoutDelivery(methodTypes);
  const choice = chooseDeliveryMode(cart.mode, checkout);
  if (choice.contradicted) {
    logInfo("Mode du panier contredit par le paiement", { orderId, panier: cart.mode, paiement: checkout, retenu: choice.mode });
  }
  return { ...cart, mode: choice.mode };
}

export async function copyCartDeliveryToMetafields(
  admin: AdminApiContext,
  orderId: OrderGid,
  attributes: readonly NoteAttribute[],
): Promise<CopyOutcome> {
  const cart = readCartDelivery(attributes);
  for (const ignored of cart.ignored) {
    // Ni la valeur ni le client ne sont journalisés : seulement l'attribut et la raison.
    logInfo("Attribut de livraison ignoré", { orderId, attribute: ignored.attribute, reason: ignored.reason });
  }

  const state = await runAdminGraphql<OrderDeliveryMetafieldsData>(admin, ORDER_DELIVERY_METAFIELDS_QUERY, { id: orderId });
  if (!state.ok) {
    logError("Métachamps livraison illisibles", state.error, { orderId });
    return "a_reessayer";
  }
  if (state.value.order === null) {
    logError("Commande introuvable pour les métachamps livraison", new Error("Commande absente"), { orderId });
    return "rien_a_faire";
  }
  const delivery = withCheckoutMode(orderId, cart, state.value.order);
  const metafields = metafieldsToSet(orderId, delivery, existingFrom(state.value.order));
  if (metafields.length === 0) return "rien_a_faire";
  const result = await setMetafields(admin, metafields);
  if (!result.ok) {
    logError("Métachamps livraison non posés", result.error, { orderId });
    // Refus de Shopify (valeur rejetée) : inutile de réessayer. Panne : Shopify renverra le webhook.
    return result.error instanceof ShopifyUserErrors ? "rien_a_faire" : "a_reessayer";
  }
  logInfo("Métachamps livraison posés", { orderId, count: metafields.length });
  return "fait";
}
