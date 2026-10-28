import { formatChf } from "../format/money";
import { formatSwissDate } from "../format/dates";
import { NNBSP } from "../format/typography";
import type { IsoDate } from "../metafields/definitions";

/** Textes envoyés au client avec sa facture (WhatsApp et e-mail). */

export interface InvoiceMessageData {
  readonly number: string;
  readonly orderName: string;
  readonly totalCents: number;
  readonly sellerName: string;
  readonly dueDate: IsoDate | null;
  /** Date de paiement : renseignée pour un reçu pro (facture déjà payée), sinon null. */
  readonly paidOn: IsoDate | null;
}

function dueLine(data: InvoiceMessageData): string {
  return data.dueDate === null ? "" : ` à régler d’ici au ${formatSwissDate(data.dueDate)}`;
}

export function whatsappMessage(data: InvoiceMessageData, link: string): string {
  if (data.paidOn !== null) {
    return [
      `Bonjour, voici votre reçu pro ${data.number} (commande ${data.orderName}) de ${formatChf(data.totalCents)}, payé le ${formatSwissDate(data.paidOn)}${NNBSP}: ${link}`,
      `Merci${NNBSP}!`,
      data.sellerName,
    ].join("\n");
  }
  return [
    `Bonjour, voici votre facture ${data.number} (commande ${data.orderName}) de ${formatChf(data.totalCents)}${dueLine(data)}.`,
    `Le PDF, avec la QR-facture pour payer depuis votre app bancaire${NNBSP}: ${link}`,
    `Merci et à bientôt${NNBSP}!`,
    data.sellerName,
  ].join("\n");
}

export function emailSubject(data: InvoiceMessageData): string {
  if (data.paidOn !== null) return `Reçu pro ${data.number} — ${data.sellerName}`;
  return `Facture ${data.number} — ${data.sellerName}`;
}

export function emailText(data: InvoiceMessageData): string {
  if (data.paidOn !== null) {
    return [
      "Bonjour,",
      "",
      `Merci pour votre commande ${data.orderName}. Votre paiement de ${formatChf(data.totalCents)} est bien reçu (${formatSwissDate(data.paidOn)}).`,
      `Vous trouverez en pièce jointe votre reçu pro, la facture acquittée ${data.number}\u00a0: aucun autre paiement n’est dû.`,
      "",
      "Avec nos meilleures salutations,",
      data.sellerName,
    ].join("\n");
  }
  return [
    "Bonjour,",
    "",
    `Vous trouverez en pièce jointe la facture ${data.number} pour la commande ${data.orderName}, d’un montant de ${formatChf(data.totalCents)}${dueLine(data)}.`,
    "La QR-facture en bas du document se paie directement depuis votre app bancaire.",
    "",
    "Avec nos meilleures salutations,",
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
