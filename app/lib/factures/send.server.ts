import { failure, success, type Result } from "../core/result";
import { parseIsoDate } from "../metafields/definitions";
import { loadCompleteSettings } from "../reglages/settings.server";
import { sendInvoiceEmail } from "./email.server";
import { InvoiceError } from "./errors";
import { emailSubject, emailText, whatsappMessage, type InvoiceMessageData } from "./messages";
import { whatsappUrl } from "./phone";
import { invoiceShareUrl } from "./links.server";
import { getShopInvoice, readInvoicePdf, recordInvoiceSent, type Invoice } from "./repository.server";

/** Envoi d'une facture au client : e-mail avec PDF joint, ou lien WhatsApp. */

export function invoiceFileName(invoice: Pick<Invoice, "number" | "paidOn">): string {
  return invoice.paidOn === null ? `Facture-${invoice.number}.pdf` : `Recu-pro-${invoice.number}.pdf`;
}

function messageData(invoice: Invoice, sellerName: string): InvoiceMessageData {
  return {
    number: invoice.number,
    orderName: invoice.orderName,
    totalCents: invoice.totalCents,
    sellerName,
    dueDate: parseIsoDate(invoice.dueDate),
    paidOn: invoice.paidOn === null ? null : parseIsoDate(invoice.paidOn),
  };
}

export async function emailInvoice(shop: string, invoiceId: string): Promise<Result<string, InvoiceError>> {
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failure(new InvoiceError("facture_introuvable"));
  if (invoice.customerEmail === null) return failure(new InvoiceError("destinataire_manquant"));
  const settings = await loadCompleteSettings(shop);
  if (settings === null) return failure(new InvoiceError("reglages_incomplets"));
  const pdf = await readInvoicePdf(invoice.pdfKey);
  if (pdf === null) return failure(new InvoiceError("facture_introuvable"));
  const data = messageData(invoice, settings.legalName);
  const sent = await sendInvoiceEmail({
    to: invoice.customerEmail,
    replyTo: settings.email,
    subject: emailSubject(data),
    text: emailText(data),
    fileName: invoiceFileName(invoice),
    pdf,
  });
  if (!sent.ok) return sent;
  await recordInvoiceSent(invoice.id, invoice.customerEmail, "email");
  return success(invoice.customerEmail);
}

/** Lien wa.me prérempli, ou `null` si le client n'a pas de numéro exploitable. */
export function whatsappLinkFor(invoice: Invoice, sellerName: string, now: Date = new Date()): string | null {
  if (invoice.customerPhone === null) return null;
  return whatsappUrl(invoice.customerPhone, whatsappMessage(messageData(invoice, sellerName), invoiceShareUrl(invoice.id, now)));
}

export async function recordWhatsappShare(shop: string, invoiceId: string): Promise<Result<true, InvoiceError>> {
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failure(new InvoiceError("facture_introuvable"));
  if (invoice.customerPhone === null) return failure(new InvoiceError("telephone_manquant"));
  await recordInvoiceSent(invoice.id, invoice.customerPhone, "whatsapp");
  return success(true);
}
