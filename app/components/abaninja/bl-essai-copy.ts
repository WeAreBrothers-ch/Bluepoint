import { frenchTypography } from "../../lib/abaninja/trial-typography";

/** Textes fixes de l'essai « bon de livraison → facture », typographie française appliquée une fois pour toutes. */

export const BL_COPY = {
  heading: "Essai : bon de livraison, puis facture",
  intro: frenchTypography(
    "Pour voir le futur circuit sur une commande fictive : l’app crée un client d’essai et son bon de livraison dans AbaNinja, puis transforme ce bon en facture, comme le jour où vous cliquerez « J’ai livré ». Tout reste en brouillon et rien n’est envoyé à personne.",
  ),
  orderLabel: "Commande fictive",
  noOrders: frenchTypography("Aucune commande étiquetée « fictif » dans Shopify : l’essai n’a rien sur quoi partir."),
  ordersUnavailable: frenchTypography("Shopify n’a pas donné la liste des commandes fictives. Rechargez la page dans un instant."),
  create: "1. Créer le bon de livraison",
  convert: "2. Transformer en facture",
  convertNote: frenchTypography(
    "Si AbaNinja donne un vrai numéro à cette facture d’essai, elle ne pourra plus être effacée, seulement annulée : l’étape 3 vous le dira.",
  ),
  erase: "3. Tout effacer d’AbaNinja",
  eraseEarly: "Tout effacer sans faire la facture",
  current: frenchTypography("Essai en cours, référence : "),
  busy: frenchTypography("Patientez, AbaNinja répond en général en quelques secondes. Ne quittez pas la page."),
  finished: frenchTypography("Étape terminée. Le résultat est ci-dessous."),
} as const;
