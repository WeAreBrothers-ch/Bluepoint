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
  reglages_incomplets: "Les réglages de facturation sont incomplets\u202F: aucune facture n’a été créée.",
  commande_introuvable: "Cette commande est introuvable dans Shopify.",
  commande_non_livree: "La commande n’est pas encore expédiée\u202F: la facture doit indiquer la date de livraison.",
  donnees_invalides: "La facture ne peut pas être créée.",
  shopify_indisponible: "Shopify ne répond pas pour le moment. Réessayez dans un instant.",
  facture_introuvable: "Cette facture est introuvable.",
  envoi_non_configure: "L’envoi par e-mail n’est pas configuré (clé Resend et adresse d’expédition manquantes).",
  destinataire_manquant: "Aucune adresse e-mail n’est connue pour ce client.",
  telephone_manquant: "Aucun numéro de portable exploitable n’est connu pour ce client.",
  envoi_echoue: "L’e-mail n’a pas pu être envoyé.",
  erreur_interne: "Une erreur inattendue est survenue. Réessayez\u202F; si elle persiste, contactez le support.",
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
