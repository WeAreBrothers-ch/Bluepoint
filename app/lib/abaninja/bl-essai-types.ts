/** Essai « bon de livraison → facture » : ce que la page reçoit après chaque bouton. */

/** Début de la référence de tous les bons d'essai : l'effacement n'accepte que ces documents. */
export const DELIVERY_NOTE_TRIAL_PREFIX = "BP-ESSAI-BL-";

/** Les documents d'essai créés dans AbaNinja, que la page garde pour l'étape suivante. */
export interface TrialDocuments {
  readonly noteUuid: string;
  /** Facture issue du bon ; null tant que le bon n'est pas transformé. */
  readonly invoiceUuid: string | null;
  /** Référence du bon (affichage seulement : le serveur relit toujours celle d'AbaNinja). */
  readonly reference: string;
}

export type TrialTone = "success" | "warning" | "critical" | "info";

export interface DeliveryNoteTrialOutcome {
  readonly tone: TrialTone;
  readonly heading: string;
  readonly details: readonly string[];
  /** Ce qui reste à suivre dans AbaNinja ; null : plus rien d'essai à effacer depuis cette page. */
  readonly documents: TrialDocuments | null;
}
