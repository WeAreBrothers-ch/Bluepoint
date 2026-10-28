/** Erreurs des factures, avec un message en français prêt à afficher. */

export type InvoiceErrorCode =
  | "reglages_incomplets"
  | "commande_introuvable"
  | "commande_non_livree"
  | "donnees_invalides"
  | "shopify_indisponible"
  | "facture_introuvable"
  | "envoi_non_configure"
  | "destinataire_manquant"
  | "telephone_manquant"
  | "envoi_echoue"
  | "erreur_interne";

const MESSAGES: Readonly<Record<InvoiceErrorCode, string>> = {
  reglages_incomplets: "La facture n’a pas été faite\u202F: il manque vos coordonnées ou votre compte bancaire.",
  commande_introuvable: "Cette commande n’existe plus dans Shopify (elle a peut-être été supprimée).",
  commande_non_livree: "Touchez d’abord « J’ai livré la commande »\u202F: la facture indique le jour de livraison.",
  donnees_invalides: "La facture n’a pas pu être faite.",
  shopify_indisponible: "Shopify ne répond pas pour le moment. Réessayez dans un instant.",
  facture_introuvable: "Cette facture n’existe plus.",
  envoi_non_configure: "L’envoi des factures par e-mail n’est pas encore installé.",
  destinataire_manquant: "Ce client n’a pas d’adresse e-mail.",
  telephone_manquant: "Ce client n’a pas de numéro de portable valable.",
  envoi_echoue: "L’e-mail n’est pas parti. Vérifiez l’adresse du client, puis réessayez.",
  erreur_interne: "Ça n’a pas marché. Réessayez dans un instant.",
};

export class InvoiceError extends Error {
  override readonly name = "InvoiceError";

  constructor(
    readonly code: InvoiceErrorCode,
    /** Précisions à afficher sous le message (ex. adresse à corriger dans Shopify). */
    readonly details: readonly string[] = [],
  ) {
    super(MESSAGES[code]);
  }
}
