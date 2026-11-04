import { formatChf, formatInteger } from "../format/money";
import { formatSwissDate } from "../format/dates";
import { NNBSP } from "../format/typography";
import type { EarlyPaymentOffer } from "../escompte/early-payment";
import type { IsoDate } from "../metafields/definitions";

/** Textes proposés au client avec sa facture ou son reçu (WhatsApp et e-mail), modifiables avant l'envoi. */

export interface MessageLine {
  readonly quantity: number;
  readonly label: string;
}

export interface InvoiceMessageData {
  readonly number: string;
  readonly orderName: string;
  readonly totalCents: number;
  readonly sellerName: string;
  readonly dueDate: IsoDate | null;
  /** Date de paiement : renseignée pour un reçu pro (facture acquittée), sinon null. */
  readonly paidOn: IsoDate | null;
  /** Ce qui a été commandé ; vide si Shopify n'a pas pu le donner (le message reste correct). */
  readonly lines: readonly MessageLine[];
  /** Rabais de paiement rapide encore valable, ou null (reçu, délai passé, relance). */
  readonly earlyPayment?: EarlyPaymentOffer | null;
}

/** Au-delà, le récapitulatif renvoie au PDF pour ne pas noyer le message. */
const MAX_SUMMARY_LINES = 12;

/** « – 12 × Dézaley Marsens », une ligne par produit. */
export function orderSummary(lines: readonly MessageLine[]): string[] {
  const shown = lines.slice(0, MAX_SUMMARY_LINES).map((line) => `– ${formatInteger(line.quantity)} × ${line.label}`);
  const hidden = lines.length - shown.length;
  return hidden > 0 ? [...shown, `– et ${formatInteger(hidden)} autre${hidden > 1 ? "s" : ""} produit${hidden > 1 ? "s" : ""} (voir le PDF)`] : shown;
}

function summaryBlock(data: InvoiceMessageData): string[] {
  return data.lines.length === 0 ? [] : [`Récapitulatif de la commande${NNBSP}:`, ...orderSummary(data.lines), ""];
}

function documentName(data: InvoiceMessageData): string {
  return data.paidOn === null ? `votre facture ${data.number}` : `votre reçu ${data.number}`;
}

function totalLine(data: InvoiceMessageData): string {
  if (data.paidOn !== null) {
    return `Total payé${NNBSP}: ${formatChf(data.totalCents)}, le ${formatSwissDate(data.paidOn)}. Aucun autre paiement n’est dû.`;
  }
  const due = data.dueDate === null ? "" : `, à régler d’ici au ${formatSwissDate(data.dueDate)}`;
  return `Total${NNBSP}: ${formatChf(data.totalCents)}${due}.`;
}

/** « Rabais de 2 % si vous payez jusqu'au 14.11.2026 : CHF 764.40 au lieu de CHF 780.00. » ; aucune ligne sans rabais. */
function earlyPaymentLine(data: InvoiceMessageData): string[] {
  const offer = data.earlyPayment;
  if (data.paidOn !== null || offer === undefined || offer === null) return [];
  const percent = String(offer.percent).replace(".", ",");
  return [
    `Rabais de ${percent}${NNBSP}% si vous payez jusqu’au ${formatSwissDate(offer.deadline)}${NNBSP}: ${formatChf(offer.amountCents)} au lieu de ${formatChf(data.totalCents)}.`,
  ];
}

export function emailSubject(data: InvoiceMessageData): string {
  const kind = data.paidOn === null ? "Facture" : "Reçu";
  return `${kind} ${data.number} — commande ${data.orderName} — ${data.sellerName}`;
}

export function emailText(data: InvoiceMessageData): string {
  const attachment = data.paidOn === null
    ? "Le PDF est en pièce jointe. La QR-facture en bas du document se paie directement depuis votre app bancaire."
    : "Le reçu (facture acquittée) est en pièce jointe.";
  return [
    "Bonjour,",
    "",
    `Voici ${documentName(data)} pour la commande ${data.orderName}.`,
    "",
    ...summaryBlock(data),
    totalLine(data),
    ...earlyPaymentLine(data),
    attachment,
    "",
    "Avec nos meilleures salutations,",
    data.sellerName,
  ].join("\n");
}

export function whatsappMessage(data: InvoiceMessageData, link: string): string {
  const linkLabel = data.paidOn === null ? "Le PDF, avec la QR-facture pour payer depuis votre app bancaire" : "Le reçu en PDF";
  return [
    `Bonjour, voici ${documentName(data)} pour la commande ${data.orderName}.`,
    "",
    ...summaryBlock(data),
    totalLine(data),
    ...earlyPaymentLine(data),
    `${linkLabel}${NNBSP}: ${link}`,
    "",
    `Merci et à bientôt${NNBSP}!`,
    data.sellerName,
  ].join("\n");
}

/** Relance WhatsApp d'une facture échue, polie et courte, avec le lien vers le PDF. */
export function whatsappReminder(data: InvoiceMessageData, link: string): string {
  const due = data.dueDate === null ? "" : `, échue le ${formatSwissDate(data.dueDate)}`;
  return [
    `Bonjour, sauf erreur de notre part, la facture ${data.number} (commande ${data.orderName}) de ${formatChf(data.totalCents)}${due}, n’est pas encore réglée.`,
    `La voici à nouveau, avec la QR-facture pour payer depuis votre app bancaire${NNBSP}: ${link}`,
    `Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.`,
    data.sellerName,
  ].join("\n");
}

export function reminderEmailSubject(data: InvoiceMessageData): string {
  return `Rappel${NNBSP}: facture ${data.number} — ${data.sellerName}`;
}

export function reminderEmailText(data: InvoiceMessageData): string {
  const due = data.dueDate === null ? "" : `, échue le ${formatSwissDate(data.dueDate)}`;
  return [
    "Bonjour,",
    "",
    `Sauf erreur de notre part, la facture ${data.number} pour la commande ${data.orderName}, d’un montant de ${formatChf(data.totalCents)}${due}, n’est pas encore réglée.`,
    "Vous la trouverez à nouveau en pièce jointe. La QR-facture en bas du document se paie directement depuis votre app bancaire.",
    "Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.",
    "",
    "Avec nos meilleures salutations,",
    data.sellerName,
  ].join("\n");
}
