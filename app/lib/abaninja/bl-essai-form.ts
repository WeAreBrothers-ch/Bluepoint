import { DELIVERY_NOTE_TRIAL_PREFIX, type TrialDocuments } from "./bl-essai-types";
import { isUuid } from "./uuid";

/** Essai « bon de livraison → facture » : lecture stricte de ce que la page envoie (ou garde). */

export type DeliveryNoteTrialForm =
  | { readonly kind: "creer"; readonly orderId: string }
  | { readonly kind: "facturer"; readonly documents: TrialDocuments }
  | { readonly kind: "effacer"; readonly documents: TrialDocuments }
  | { readonly kind: "refuse" };

const INTENTS = ["bl-creer", "bl-facturer", "bl-effacer"] as const;
const ORDER_GID = /^gid:\/\/shopify\/Order\/\d{1,20}$/;
const REFERENCE_PATTERN = /^[A-Za-z0-9-]{1,80}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isDeliveryNoteTrialIntent(formData: FormData): boolean {
  const intent = text(formData.get("intent"));
  return INTENTS.some((known) => known === intent);
}

/** Documents valides, ou null : identifiants UUID et référence d'essai uniquement. */
export function readTrialDocuments(source: unknown): TrialDocuments | null {
  if (typeof source !== "object" || source === null) return null;
  const record = source as Readonly<Record<string, unknown>>;
  const noteUuid = text(record["noteUuid"]);
  const invoiceUuid = text(record["invoiceUuid"]);
  const reference = text(record["reference"]);
  if (!isUuid(noteUuid)) return null;
  if (invoiceUuid !== "" && !isUuid(invoiceUuid)) return null;
  if (!reference.startsWith(DELIVERY_NOTE_TRIAL_PREFIX) || !REFERENCE_PATTERN.test(reference)) return null;
  return { noteUuid, invoiceUuid: invoiceUuid === "" ? null : invoiceUuid, reference };
}

export function parseDeliveryNoteTrialForm(formData: FormData): DeliveryNoteTrialForm {
  const intent = text(formData.get("intent"));
  if (intent === "bl-creer") {
    const orderId = text(formData.get("orderId"));
    return ORDER_GID.test(orderId) ? { kind: "creer", orderId } : { kind: "refuse" };
  }
  const documents = readTrialDocuments(Object.fromEntries(formData.entries()));
  if (documents === null) return { kind: "refuse" };
  if (intent === "bl-facturer") return { kind: "facturer", documents };
  if (intent === "bl-effacer") return { kind: "effacer", documents };
  return { kind: "refuse" };
}
