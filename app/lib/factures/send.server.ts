import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import { swissIsoDate } from "../agenda/dates";
import { earlyPaymentOffer } from "../escompte/early-payment";
import { parseIsoDate } from "../metafields/definitions";
import { loadCompleteSettings } from "../reglages/settings.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { sendInvoiceEmail } from "./email.server";
import { InvoiceError } from "./errors";
import type { EditedEmail } from "./message-input";
import {
  emailSubject,
  emailText,
  reminderEmailSubject,
  reminderEmailText,
  whatsappReminder,
  type InvoiceMessageData,
  type MessageLine,
} from "./messages";
import { ORDER_LINES_QUERY, toMessageLines, type OrderLinesData } from "./order-lines";
import { whatsappUrl } from "./phone";
import { invoiceShareUrl } from "./links.server";
import { getShopInvoice, readInvoicePdf, recordInvoiceSent, type Invoice } from "./repository.server";

/** Envoi d'une facture au client : e-mail avec PDF joint, ou envoi WhatsApp noté. */

export function invoiceFileName(invoice: Pick<Invoice, "number" | "paidOn">): string {
  return invoice.paidOn === null ? `Facture-${invoice.number}.pdf` : `Recu-pro-${invoice.number}.pdf`;
}

/** Données du message sans le récapitulatif des vins (relances) : aucun appel à Shopify. */
function messageData(invoice: Invoice, sellerName: string, now: Date = new Date()): InvoiceMessageData {
  return {
    earlyPayment: earlyPaymentOffer(invoice, swissIsoDate(now)),
    number: invoice.number,
    orderName: invoice.orderName,
    totalCents: invoice.totalCents,
    sellerName,
    dueDate: parseIsoDate(invoice.dueDate),
    paidOn: invoice.paidOn === null ? null : parseIsoDate(invoice.paidOn),
    lines: [],
  };
}

/** Ce qui a été commandé, lu dans Shopify. Liste vide si Shopify ne répond pas : le message reste envoyable. */
async function loadMessageLines(admin: AdminApiContext, invoice: Invoice): Promise<MessageLine[]> {
  const orderId = parseGid(invoice.orderId, "Order");
  if (orderId === null) return [];
  const result = await runAdminGraphql<OrderLinesData>(admin, ORDER_LINES_QUERY, { id: orderId });
  if (!result.ok) {
    logError("Récapitulatif de commande indisponible pour le message", result.error, { orderId });
    return [];
  }
  return toMessageLines(result.value.order?.lineItems.nodes ?? []);
}

/** Données du message d'envoi, avec le récapitulatif des vins de la commande. */
export async function invoiceMessageData(admin: AdminApiContext, invoice: Invoice, sellerName: string): Promise<InvoiceMessageData> {
  return { ...messageData(invoice, sellerName), lines: await loadMessageLines(admin, invoice) };
}

/** « facture » : premier envoi ; « relance » : rappel d'une facture échue, PDF joint à nouveau. */
export type EmailKind = "facture" | "relance";

async function defaultEmail(admin: AdminApiContext, invoice: Invoice, sellerName: string, kind: EmailKind): Promise<EditedEmail> {
  if (kind === "relance") {
    const data = messageData(invoice, sellerName);
    return { subject: reminderEmailSubject(data), text: reminderEmailText(data) };
  }
  const data = await invoiceMessageData(admin, invoice, sellerName);
  return { subject: emailSubject(data), text: emailText(data) };
}

/**
 * Envoie la facture par e-mail. `edited` : objet et message relus (et peut-être modifiés) par l'équipe ;
 * sans lui (reçu automatique, relance), le texte proposé par défaut est utilisé.
 */
export async function emailInvoice(
  admin: AdminApiContext,
  shop: string,
  invoiceId: string,
  kind: EmailKind = "facture",
  edited: EditedEmail | null = null,
): Promise<Result<string, InvoiceError>> {
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failure(new InvoiceError("facture_introuvable"));
  if (invoice.customerEmail === null) return failure(new InvoiceError("destinataire_manquant"));
  const settings = await loadCompleteSettings(shop);
  if (settings === null) return failure(new InvoiceError("reglages_incomplets"));
  const pdf = await readInvoicePdf(invoice.pdfKey);
  if (pdf === null) return failure(new InvoiceError("facture_introuvable"));
  const message = edited ?? (await defaultEmail(admin, invoice, settings.legalName, kind));
  const sent = await sendInvoiceEmail({
    to: invoice.customerEmail,
    replyTo: settings.email,
    subject: message.subject,
    text: message.text,
    fileName: invoiceFileName(invoice),
    pdf,
  });
  if (!sent.ok) return sent;
  if (kind === "facture") await recordInvoiceSent(invoice.id, invoice.customerEmail, "email");
  return success(invoice.customerEmail);
}

/** Lien wa.me de relance (facture échue), ou `null` sans numéro de portable. */
export function whatsappReminderLinkFor(invoice: Invoice, sellerName: string, now: Date = new Date()): string | null {
  if (invoice.customerPhone === null) return null;
  return whatsappUrl(invoice.customerPhone, whatsappReminder(messageData(invoice, sellerName), invoiceShareUrl(invoice.id, now)));
}

export async function recordWhatsappShare(shop: string, invoiceId: string): Promise<Result<true, InvoiceError>> {
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failure(new InvoiceError("facture_introuvable"));
  if (invoice.customerPhone === null) return failure(new InvoiceError("telephone_manquant"));
  await recordInvoiceSent(invoice.id, invoice.customerPhone, "whatsapp");
  return success(true);
}
