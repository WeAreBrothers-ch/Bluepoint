import type { Result } from "../core/result";

/** Échec de la facture AbaNinja faite à la livraison ; message et précisions écrits pour Eliott. */

export type SaleInvoiceOutcome = "refusee" | "incertaine";

/** Rappel affiché quand l'essai doit être effacé avant de recommencer. */
export const ERASE_HINT =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai », puis « Faire la facture » sur la commande.";

/** Même rappel pour une facture née d'un bon de livraison : l'effacement prend le bon, la facture et le client d'essai. */
export const SALE_ERASE_HINT =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai » (il efface aussi les bons), puis « Créer le bon de livraison » et « Faire la facture » sur la commande.";

/** Rappel pour refaire un bon de livraison : l'effacement prend le bon et le client d'essai. */
export const NOTE_ERASE_HINT =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai » (il efface aussi les bons), puis « Créer le bon de livraison » sur la commande.";

/** Une facture née du bon existe déjà : « Faire la facture » la reprend sans en refaire une. */
export const RETRY_HINT = "Touchez « Faire la facture » pour réessayer : la facture déjà faite sera reprise, jamais refaite.";

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

/**
 * Pour le journal : pourquoi un état n'a pas été noté (null : il l'a été). Faux veut dire que la ligne
 * n'était plus dans l'état attendu, par exemple changée entre-temps par une autre action.
 */
export function unsavedChange(result: Result<boolean, Error>): Error | null {
  if (!result.ok) return result.error;
  return result.value ? null : new Error("La ligne de vente n’était plus dans l’état attendu : rien n’a été changé.");
}
