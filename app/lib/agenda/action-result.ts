/** Réponse des actions de l'agenda (« C'est livré », « Faire la facture », « Choisir le jour »), sérialisable. */

export type AgendaIntent = "livrer" | "facturer" | "dater";

export const AGENDA_INTENTS: readonly AgendaIntent[] = ["livrer", "facturer", "dater"];

export function isAgendaIntent(value: unknown): value is AgendaIntent {
  return AGENDA_INTENTS.some((intent) => intent === value);
}

export interface AgendaActionSuccess {
  readonly ok: true;
  readonly orderId: string;
  readonly message: string;
  /** Facture disponible après l'action. */
  readonly invoice: { readonly id: string; readonly number: string } | null;
  /** Remarque non bloquante (ex. livrée, mais facture non créée). */
  readonly warning: string | null;
  readonly warningDetails: readonly string[];
  readonly settingsLink: boolean;
}

export interface AgendaActionFailure {
  readonly ok: false;
  readonly orderId: string;
  readonly message: string;
  readonly details: readonly string[];
  /** Afficher le lien vers la page Réglages. */
  readonly settingsLink: boolean;
}

export type AgendaActionResult = AgendaActionSuccess | AgendaActionFailure;
