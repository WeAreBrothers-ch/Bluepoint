import { failure, success, type Result } from "../core/result";
import { DELIVERY_NOTE_TRIAL_PREFIX } from "./bl-essai-types";
import type { AbaNinjaConfig } from "./config.server";
import { getDeliveryNote, type DeliveryNoteDetails } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";

/** Essai « bon de livraison → facture » : relecture vérifiée du bon et mots affichés à Eliott. */

const STATUS_WORDS: Readonly<Record<string, string>> = {
  draft: "brouillon",
  open: "ouvert",
  sending: "en cours d’envoi",
  sent: "envoyé",
  viewed: "consulté",
  approved: "accepté",
  declined: "refusé",
  converted: "transformé",
  partial: "payé en partie",
  paid: "payé",
  cancelled: "annulé",
  archived: "archivé",
};

/** Statut AbaNinja en français ; un statut inconnu est montré tel quel, entre guillemets. */
export function statusWord(status: string): string {
  return STATUS_WORDS[status] ?? `« ${status.replace(/[^A-Za-z_-]/g, "").slice(0, 30)} »`;
}

/** 738 → « 738.00 CHF » */
export function chf(amount: number): string {
  return `${amount.toFixed(2)} CHF`;
}

/** « 2026-11-26 » → « 26.11.2026 » */
export function swissDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return year === undefined || month === undefined || day === undefined ? iso : `${day}.${month}.${year}`;
}

export function isNotFound(error: AbaNinjaError): boolean {
  return error.status === 404 || error.code === "introuvable";
}

/** Pourquoi le bon d'essai n'a pas pu être relu : absent, AbaNinja indisponible, ou pas un bon d'essai. */
export class TrialNoteError extends Error {
  constructor(
    readonly reason: "introuvable" | "abaninja" | "pas_un_essai",
    message: string,
  ) {
    super(message);
    this.name = "TrialNoteError";
  }
}

/** Relit le bon dans AbaNinja et refuse tout bon dont la référence n'est pas celle d'un essai. */
export async function readTrialNote(config: AbaNinjaConfig, noteUuid: string): Promise<Result<DeliveryNoteDetails, TrialNoteError>> {
  const note = await getDeliveryNote(config, noteUuid);
  if (!note.ok) {
    return isNotFound(note.error)
      ? failure(new TrialNoteError("introuvable", "Le bon d’essai n’existe plus dans AbaNinja."))
      : failure(new TrialNoteError("abaninja", `Le bon d’essai n’a pas pu être relu dans AbaNinja. ${note.error.message}`));
  }
  if (note.value.reference?.startsWith(DELIVERY_NOTE_TRIAL_PREFIX) !== true) {
    return failure(new TrialNoteError("pas_un_essai", "Ce bon n’est pas un bon d’essai : la page n’y touche pas."));
  }
  return success(note.value);
}
