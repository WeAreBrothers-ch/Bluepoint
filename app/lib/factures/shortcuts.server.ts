import { invoiceShareUrl } from "./links.server";
import { preferredChannel, readSentVia, sentLabel, type InvoiceShortcuts, type SentVia } from "./list-item";
import type { Invoice } from "./repository.server";
import { whatsappLinkFor } from "./send.server";

/** Raccourcis d'une facture (voir, WhatsApp, e-mail) et canal préféré de chaque client. */

/** Un même client : son portable, sinon son e-mail, sinon son nom. */
function customerKey(invoice: Pick<Invoice, "customerPhone" | "customerEmail" | "customerName">): string {
  return invoice.customerPhone ?? invoice.customerEmail ?? invoice.customerName.trim().toLowerCase();
}

/** Dernier canal utilisé par client, à partir des factures les plus récentes d'abord. */
export function channelsByCustomer(recentFirst: readonly Invoice[]): Map<string, SentVia> {
  const channels = new Map<string, SentVia>();
  for (const invoice of recentFirst) {
    const via = readSentVia(invoice.sentVia);
    const key = customerKey(invoice);
    if (via !== null && !channels.has(key)) channels.set(key, via);
  }
  return channels;
}

export function invoiceShortcuts(
  invoice: Invoice,
  sellerName: string | null,
  channels: ReadonlyMap<string, SentVia>,
  now: Date,
): InvoiceShortcuts {
  const whatsappUrl = sellerName === null ? null : whatsappLinkFor(invoice, sellerName, now);
  const own = readSentVia(invoice.sentVia);
  return {
    id: invoice.id,
    number: invoice.number,
    viewUrl: invoiceShareUrl(invoice.id, now),
    whatsappUrl,
    customerEmail: invoice.customerEmail,
    preferredChannel: preferredChannel(own, channels.get(customerKey(invoice)) ?? null, whatsappUrl !== null),
    sentLabel: sentLabel(invoice.sentAt, own),
  };
}
