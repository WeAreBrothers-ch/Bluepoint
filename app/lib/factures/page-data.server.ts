import { loadCompleteSettings } from "../reglages/settings.server";
import { isEmailConfigured } from "./email.server";
import { readSentVia, type InvoiceListItem } from "./list-item";
import { listInvoices, type Invoice } from "./repository.server";

/** Données de la page Factures. */

export interface FacturesPageData {
  readonly invoices: readonly InvoiceListItem[];
  readonly emailConfigured: boolean;
  readonly settingsComplete: boolean;
}

function toListItem(invoice: Invoice): InvoiceListItem {
  return {
    id: invoice.id,
    number: invoice.number,
    orderName: invoice.orderName,
    customerName: invoice.customerName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paidOn: invoice.paidOn,
    totalCents: invoice.totalCents,
    sentAt: invoice.sentAt?.toISOString() ?? null,
    sentTo: invoice.sentTo,
    sentVia: readSentVia(invoice.sentVia),
    customerEmail: invoice.customerEmail,
    whatsappAvailable: invoice.customerPhone !== null,
  };
}

export async function loadFacturesPage(shop: string): Promise<FacturesPageData> {
  const [invoices, settings] = await Promise.all([listInvoices(shop), loadCompleteSettings(shop)]);
  return {
    invoices: invoices.map(toListItem),
    emailConfigured: isEmailConfigured(),
    settingsComplete: settings !== null,
  };
}
