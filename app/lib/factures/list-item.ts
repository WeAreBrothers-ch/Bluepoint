import { formatSwissDateTime } from "../format/dates";

/** Nombre maximal de factures affichées dans la liste (les plus récentes). */
export const INVOICE_LIST_LIMIT = 200;

/** Facture telle qu'affichée dans la liste (sérialisable, sans le PDF). */

export type SentVia = "email" | "whatsapp";

export interface InvoiceListItem {
  readonly id: string;
  readonly number: string;
  readonly orderName: string;
  readonly customerName: string;
  readonly issueDate: string;
  readonly dueDate: string;
  /** Date de paiement d'un reçu pro (facture acquittée), ou null. */
  readonly paidOn: string | null;
  readonly totalCents: number;
  /** Horodatage ISO de l'envoi, ou null si jamais envoyée. */
  readonly sentAt: string | null;
  readonly sentTo: string | null;
  readonly sentVia: SentVia | null;
  readonly customerEmail: string | null;
  /** Lien wa.me prérempli (lien signé valable 14 jours), ou null sans numéro de portable. */
  readonly whatsappUrl: string | null;
}

export function readSentVia(value: string | null): SentVia | null {
  return value === "email" || value === "whatsapp" ? value : null;
}

export interface SentStatus {
  readonly label: string;
  readonly tone: "success" | "neutral";
}

export function sentStatus(item: Pick<InvoiceListItem, "sentAt" | "sentTo" | "sentVia">): SentStatus {
  if (item.sentAt === null) return { label: "Pas encore envoyée", tone: "neutral" };
  const when = formatSwissDateTime(new Date(item.sentAt));
  const channel = item.sentVia === "whatsapp" ? "WhatsApp" : "e-mail";
  const to = item.sentTo === null ? "" : ` à ${item.sentTo}`;
  return { label: `Envoyée par ${channel}${to}, le ${when}`, tone: "success" };
}

export type FacturesIntent = "email" | "whatsapp";

export function isFacturesIntent(value: unknown): value is FacturesIntent {
  return value === "email" || value === "whatsapp";
}

export type FacturesActionResult =
  | { readonly ok: true; readonly invoiceId: string; readonly message: string }
  | { readonly ok: false; readonly invoiceId: string; readonly message: string; readonly settingsLink: boolean };
