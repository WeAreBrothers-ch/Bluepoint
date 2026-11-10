/**
 * Interprétation du statut d'une facture AbaNinja (fonction pure).
 * Les règles sont des DÉDUCTIONS de la documentation (spec §3), pas des règles
 * officielles : toute valeur non reconnue donne « inconnu », jamais « payée ».
 */

export type InvoiceReadState =
  | "brouillon"
  | "envoyee"
  | "payee"
  | "partiellement_payee"
  | "en_retard"
  | "annulee"
  | "inconnu";

export interface InvoiceStatusInput {
  readonly status: string;
  readonly openAmount: number | null | undefined;
  readonly dueDate: string | null | undefined;
  readonly isCancelled?: boolean | undefined;
}

const DRAFT = new Set(["draft"]);
const CANCELLED = new Set(["cancelled"]);
const PAID = new Set(["paid"]);
const PARTIAL = new Set(["partial"]);
/** Retard déclaré par AbaNinja (échéance dépassée ou relance en cours). */
const OVERDUE = new Set(["due", "reminder", "first-dunning", "second-dunning", "final-dunning"]);
/** Facture émise et en attente de paiement (le sens exact de in-payment / awaiting-payment n'est pas documenté). */
const ISSUED = new Set(["open", "sending", "sent", "viewed", "in-payment", "awaiting-payment"]);

const ISO_DATE_START = /^\d{4}-\d{2}-\d{2}/;

/** Date du jour AAAA-MM-JJ à Zurich (le retard se juge sur le calendrier suisse). */
export function todayInZurich(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: "year" | "month" | "day"): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function isPastDue(dueDate: string | null | undefined, today: string): boolean {
  if (dueDate === null || dueDate === undefined || !ISO_DATE_START.test(dueDate)) return false;
  return dueDate.slice(0, 10) < today;
}

function isUnpaidIssued(input: InvoiceStatusInput, today: string): boolean {
  return (input.openAmount ?? 0) > 0 && isPastDue(input.dueDate, today);
}

/** `today` au format AAAA-MM-JJ (voir todayInZurich). */
export function interpretInvoiceStatus(input: InvoiceStatusInput, today: string): InvoiceReadState {
  const { status } = input;
  if (input.isCancelled === true || CANCELLED.has(status)) return "annulee";
  if (DRAFT.has(status)) return "brouillon";
  if (PAID.has(status)) return "payee";
  if (PARTIAL.has(status)) return "partiellement_payee";
  if (OVERDUE.has(status)) return "en_retard";
  if (ISSUED.has(status)) return isUnpaidIssued(input, today) ? "en_retard" : "envoyee";
  return "inconnu";
}
