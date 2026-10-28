/** Erreurs de la livraison, avec un message en français prêt à afficher. */

export type DeliveryErrorCode =
  | "commande_introuvable"
  | "commande_annulee"
  | "rien_a_expedier"
  | "expedition_bloquee"
  | "shopify_refus"
  | "shopify_indisponible";

const MESSAGES: Readonly<Record<DeliveryErrorCode, string>> = {
  commande_introuvable: "Cette commande est introuvable dans Shopify.",
  commande_annulee: "Cette commande est annulée\u202F: elle ne peut pas être livrée.",
  rien_a_expedier: "Aucun article à expédier sur cette commande.",
  expedition_bloquee:
    "L’expédition est en attente ou programmée dans Shopify. Libérez-la depuis la commande, puis réessayez.",
  shopify_refus: "Shopify a refusé l’opération.",
  shopify_indisponible: "Shopify ne répond pas pour le moment. Réessayez dans un instant.",
};

export class DeliveryError extends Error {
  override readonly name = "DeliveryError";

  constructor(
    readonly code: DeliveryErrorCode,
    detail?: string,
  ) {
    super(detail === undefined ? MESSAGES[code] : `${MESSAGES[code]} ${detail}`);
  }
}
