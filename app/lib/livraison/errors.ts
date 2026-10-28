import { plainShopifyRefusal } from "../shopify/plain-refusal";

/** Erreurs de la livraison, avec un message en français prêt à afficher. */

export type DeliveryErrorCode =
  | "commande_introuvable"
  | "commande_annulee"
  | "rien_a_expedier"
  | "expedition_bloquee"
  | "shopify_refus"
  | "shopify_indisponible";

const MESSAGES: Readonly<Record<DeliveryErrorCode, string>> = {
  commande_introuvable: "Cette commande n’existe plus dans Shopify (elle a peut-être été supprimée).",
  commande_annulee: "Cette commande a été annulée\u202F: il n’y a rien à livrer.",
  rien_a_expedier: "Il ne reste rien à livrer sur cette commande.",
  expedition_bloquee:
    "Shopify a mis cette commande en attente. Ouvrez-la dans Shopify (lien « Tous les détails » de la carte) " +
    "pour lever l’attente, puis réessayez.",
  shopify_refus: "Shopify n’a pas accepté de noter cette livraison.",
  shopify_indisponible: "Shopify ne répond pas pour le moment. Réessayez dans un instant.",
};

export class DeliveryError extends Error {
  override readonly name = "DeliveryError";

  constructor(
    readonly code: DeliveryErrorCode,
    /** Texte brut de Shopify (souvent en anglais) : pour les journaux, jamais affiché tel quel. */
    readonly detail?: string,
  ) {
    const plain = detail === undefined ? null : plainShopifyRefusal(detail);
    super(plain === null ? MESSAGES[code] : `${MESSAGES[code]} ${plain}`);
  }
}
