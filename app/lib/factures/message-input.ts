/** Objet et message d'e-mail relus par l'équipe : validés côté serveur avant l'envoi. */

export interface EditedEmail {
  readonly subject: string;
  readonly text: string;
}

export const SUBJECT_MAX_LENGTH = 200;
export const MESSAGE_MAX_LENGTH = 5000;

export type EditedEmailParse =
  | { readonly ok: true; readonly value: EditedEmail }
  | { readonly ok: false; readonly message: string };

/** Un objet tient sur une ligne : les retours à la ligne collés sont remplacés par des espaces. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function parseEditedEmail(subject: unknown, text: unknown): EditedEmailParse {
  if (typeof subject !== "string" || typeof text !== "string") return { ok: false, message: "Objet ou message manquant." };
  const cleanSubject = oneLine(subject);
  const cleanText = normalizeText(text);
  if (cleanSubject === "") return { ok: false, message: "Indiquez un objet pour l’e-mail." };
  if (cleanText === "") return { ok: false, message: "Le message est vide." };
  if (cleanSubject.length > SUBJECT_MAX_LENGTH) return { ok: false, message: `L’objet dépasse ${SUBJECT_MAX_LENGTH} caractères.` };
  if (cleanText.length > MESSAGE_MAX_LENGTH) return { ok: false, message: `Le message dépasse ${MESSAGE_MAX_LENGTH} caractères.` };
  return { ok: true, value: { subject: cleanSubject, text: cleanText } };
}
