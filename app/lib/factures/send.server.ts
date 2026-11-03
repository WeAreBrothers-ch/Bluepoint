import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import { parseIsoDate } from "../metafields/definitions";
import { loadCompleteSettings } from "../reglages/settings.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { sendInvoiceEmail } from "./email.server";
import { InvoiceError } from "./errors";
import type { EditedEmail } from "./message-input";
import { emailSubject, emailText, type InvoiceMessageData, type MessageLine } from "./messages";
import { ORDER_LINES_QUERY, toMessageLines, type OrderLinesData } from "./order-lines";
import { getShopInvoice, readInvoicePdf, recordInvoiceSent, type Invoice } from "./repository.server";

/** Envoi d'une facture au client : e-mail avec PDF joint, ou envoi WhatsApp noté. */

export function invoiceFileName(invoice: Pick<Invoice, "number" | "paidOn">): string {
  return invoice.paidOn === null ? `Facture-${invoice.number}.pdf` : `Recu-pro-${invoice.number}.pdf`;
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

export async function invoiceMessageData(admin: AdminApiContext, invoice: Invoice, sellerName: string): Promise<InvoiceMessageData> {
  return {
    number: invoice.number,
    orderName: invoice.orderName,
    totalCents: invoice.totalCents,
    sellerName,
    dueDate: parseIsoDate(invoice.dueDate),
    paidOn: invoice.paidOn === null ? null : parseIsoDate(invoice.paidOn),
    lines: await loadMessageLines(admin, invoice),
  };
}

/**
 * Envoie la facture par e-mail. `edited` : objet et message relus (et peut-être modifiés) par l'équipe ;
 * sans lui (reçu automatique), le texte proposé par défaut est utilisé.
 */
export async function emailInvoice(
  admin: AdminApiContext,
  shop: string,
  invoiceId: string,
  edited: EditedEmail | null = null,
): Promise<Result<string, InvoiceError>> {
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failure(new InvoiceError("facture_introuvable"));
  if (invoice.customerEmail === null) return failure(new InvoiceError("destinataire_manquant"));
  const settings = await loadCompleteSettings(shop);
  if (settings === null) return failure(new InvoiceError("reglages_incomplets"));
  const pdf = await readInvoicePdf(invoice.pdfKey);
  if (pdf === null) return failure(new InvoiceError("facture_introuvable"));
  const message = edited ?? (await defaultEmail(admin, invoice, settings.legalName));
  const sent = await sendInvoiceEmail({
    to: invoice.customerEmail,
    replyTo: settings.email,
    subject: message.subject,
    text: message.text,
    fileName: invoiceFileName(invoice),
    pdf,
  });
  if (!sent.ok) return sent;
  await recordInvoiceSent(invoice.id, invoice.customerEmail, "email");
  return success(invoice.customerEmail);
}

async function defaultEmail(admin: AdminApiContext, invoice: Invoice, sellerName: string): Promise<EditedEmail> {
  const data = await invoiceMessageData(admin, invoice, sellerName);
  return { subject: emailSubject(data), text: emailText(data) };
}

export async function recordWhatsappShare(shop: string, invoiceId: string): Promise<Result<true, InvoiceError>> {
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failure(new InvoiceError("facture_introuvable"));
  if (invoice.customerPhone === null) return failure(new InvoiceError("telephone_manquant"));
  await recordInvoiceSent(invoice.id, invoice.customerPhone, "whatsapp");
  return success(true);
}
