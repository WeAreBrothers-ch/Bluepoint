import type { DeliveryMode } from "../metafields/definitions";

/**
 * Le choix fait au paiement Shopify : retrait au dépôt ou envoi. Les particuliers ne choisissent plus
 * le mode dans le panier (seulement les pros) : c'est ce choix-là qui donne le mode de leur commande.
 * Logique pure, testée sans Shopify.
 */

export type CheckoutDelivery = "retrait" | "envoi" | "inconnu";

/** Types Shopify (`DeliveryMethodType`) d'une commande que BluePoint envoie ou apporte. */
const SENT_METHODS: ReadonlySet<string> = new Set(["SHIPPING", "LOCAL", "PICKUP_POINT"]);

/** Un seul type pour toute la commande, sinon « inconnu » (rien n'est deviné). */
export function readCheckoutDelivery(methodTypes: readonly string[]): CheckoutDelivery {
  if (methodTypes.length === 0) return "inconnu";
  if (methodTypes.every((type) => type === "PICK_UP")) return "retrait";
  if (methodTypes.every((type) => SENT_METHODS.has(type))) return "envoi";
  return "inconnu";
}

export interface ModeChoice {
  readonly mode: DeliveryMode | null;
  /** Le panier et le paiement disent deux choses différentes : journalisé pour qu'on le voie. */
  readonly contradicted: boolean;
}

/**
 * Le retrait choisi au paiement l'emporte : le client n'a pas payé de port. Sinon, le choix du panier
 * (pros : camion, Poste ou retrait) ; sans choix au panier, un envoi est un envoi par la Poste.
 */
export function chooseDeliveryMode(cartMode: DeliveryMode | null, checkout: CheckoutDelivery): ModeChoice {
  if (checkout === "retrait") return { mode: "retrait", contradicted: cartMode !== null && cartMode !== "retrait" };
  if (cartMode !== null) return { mode: cartMode, contradicted: checkout === "envoi" && cartMode === "retrait" };
  return { mode: checkout === "envoi" ? "poste" : null, contradicted: false };
}
