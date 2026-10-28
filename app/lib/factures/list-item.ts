import { longDay, swissIsoDate } from "../agenda/dates";
import type { PaymentState } from "./payment";

/** Nombre maximal de factures affichées dans la liste (les plus récentes). */
export const INVOICE_LIST_LIMIT = 200;

/** Facture telle qu'affichée (liste des factures, carte de l'agenda), sérialisable, sans le PDF. */

export type SentVia = "email" | "whatsapp";

/** Ce qu'il faut pour voir et envoyer une facture en un toucher. */
export interface InvoiceShortcuts {
  readonly id: string;
  readonly number: string;
  /** Lien public signé vers le PDF (14 jours) : « Voir / imprimer » dans un nouvel onglet. */
  readonly viewUrl: string;
  /** Lien wa.me prérempli, ou null sans numéro de portable (ou sans réglages vendeur). */
  readonly whatsappUrl: string | null;
  readonly customerEmail: string | null;
  /** Canal proposé en premier : celui déjà utilisé pour ce client, sinon WhatsApp s'il a un portable. */
  readonly preferredChannel: SentVia;
  /** Ex. « Envoyée par WhatsApp le jeudi 29 octobre », ou null si jamais envoyée. */
  readonly sentLabel: string | null;
}

export interface InvoiceListItem extends InvoiceShortcuts {
  readonly orderName: string;
  readonly customerName: string;
  readonly issueDate: string;
  readonly dueDate: string;
  /** Date de paiement d'un reçu pro (facture acquittée), ou null. */
  readonly paidOn: string | null;
  readonly totalCents: number;
  readonly paymentState: PaymentState;
  readonly overdueDays: number;
  /** Relance WhatsApp préremplie (facture en retard avec un portable), ou null. */
  readonly reminderWhatsappUrl: string | null;
}

export function readSentVia(value: string | null): SentVia | null {
  return value === "email" || value === "whatsapp" ? value : null;
}

/** « Envoyée par e-mail le mercredi 21 octobre » (jour suisse), ou null si jamais envoyée. */
export function sentLabel(sentAt: Date | null, sentVia: SentVia | null): string | null {
  if (sentAt === null) return null;
  const channel = sentVia === "whatsapp" ? "WhatsApp" : "e-mail";
  return `Envoyée par ${channel} le ${longDay(swissIsoDate(sentAt))}`;
}

/** Canal proposé : celui de la facture, sinon celui déjà utilisé pour ce client, sinon WhatsApp si possible. */
export function preferredChannel(own: SentVia | null, previous: SentVia | null, hasWhatsapp: boolean): SentVia {
  return own ?? previous ?? (hasWhatsapp ? "whatsapp" : "email");
}

export type FacturesIntent = "email" | "whatsapp" | "relance_email" | "payee";

const INTENTS: readonly FacturesIntent[] = ["email", "whatsapp", "relance_email", "payee"];

export function isFacturesIntent(value: unknown): value is FacturesIntent {
  return INTENTS.some((intent) => intent === value);
}

export type FacturesActionResult =
  | { readonly ok: true; readonly invoiceId: string; readonly message: string }
  | { readonly ok: false; readonly invoiceId: string; readonly message: string; readonly settingsLink: boolean };

/** Onglets de la page Factures. */
export type FacturesView = "a_encaisser" | "payees" | "toutes";

export const FACTURES_VIEWS: readonly { readonly id: FacturesView; readonly label: string }[] = [
  { id: "a_encaisser", label: "À encaisser" },
  { id: "payees", label: "Payées" },
  { id: "toutes", label: "Toutes" },
];

export function isFacturesView(value: unknown): value is FacturesView {
  return FACTURES_VIEWS.some((view) => view.id === value);
}

export interface FacturesSummary {
  readonly unpaidCount: number;
  readonly unpaidCents: number;
  readonly overdueCount: number;
  readonly overdueCents: number;
}
