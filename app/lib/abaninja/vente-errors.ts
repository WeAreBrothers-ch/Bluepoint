/** Échec de la facture AbaNinja faite à la livraison ; message et précisions écrits pour Eliott. */

export type SaleInvoiceOutcome = "refusee" | "incertaine";

/** Rappel affiché quand l'essai doit être effacé avant de recommencer. */
export const ERASE_HINT =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai », puis « Faire la facture » sur la commande.";

export class SaleInvoiceError extends Error {
  override readonly name = "SaleInvoiceError";

  constructor(
    /** refusee : rien ne reste à vérifier ; incertaine : un document existe peut-être dans AbaNinja. */
    readonly outcome: SaleInvoiceOutcome,
    message: string,
    readonly details: readonly string[] = [],
  ) {
    super(message);
  }
}
