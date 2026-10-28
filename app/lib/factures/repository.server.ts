import type { Invoice } from "@prisma/client";
import prisma from "../../db.server";
import { INVOICE_LIST_LIMIT } from "./list-item";

/** Accès aux factures enregistrées (table Invoice) et à leurs PDF (table StoredFile). */

export type { Invoice };

export function invoicePdfKey(shop: string, number: string): string {
  return `factures/${shop}/${number}.pdf`;
}

export async function findInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  return prisma.invoice.findUnique({ where: { orderId } });
}

export async function getShopInvoice(shop: string, id: string): Promise<Invoice | null> {
  return prisma.invoice.findFirst({ where: { id, shop } });
}

/** Lecture sans boutique : réservée au lien public signé, qui a déjà prouvé l'accès. */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  return prisma.invoice.findUnique({ where: { id } });
}

export async function listInvoices(shop: string): Promise<Invoice[]> {
  return prisma.invoice.findMany({ where: { shop }, orderBy: { createdAt: "desc" }, take: INVOICE_LIST_LIMIT });
}

/** Factures existantes des commandes affichées, par identifiant de commande. */
export async function invoicesByOrder(shop: string, orderIds: readonly string[]): Promise<Map<string, Invoice>> {
  if (orderIds.length === 0) return new Map();
  const invoices = await prisma.invoice.findMany({ where: { shop, orderId: { in: [...orderIds] } } });
  return new Map(invoices.map((invoice) => [invoice.orderId, invoice]));
}

export async function recordInvoiceSent(id: string, sentTo: string, sentVia: "email" | "whatsapp"): Promise<void> {
  await prisma.invoice.update({ where: { id }, data: { sentAt: new Date(), sentTo, sentVia } });
}

export async function readInvoicePdf(pdfKey: string): Promise<Uint8Array | null> {
  const file = await prisma.storedFile.findUnique({ where: { key: pdfKey }, select: { bytes: true } });
  return file === null ? null : file.bytes;
}
