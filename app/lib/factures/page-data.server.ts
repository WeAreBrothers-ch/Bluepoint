import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { logError } from "../core/logger.server";
import { loadCompleteSettings } from "../reglages/settings.server";
import { gidToNumericId, parseGid } from "../shopify";
import { isEmailConfigured } from "./email.server";
import type { FacturesSummary, FacturesView, InvoiceListItem } from "./list-item";
import { paymentSituation } from "./payment";
import { loadPaymentStatuses } from "./payment.server";
import { listInvoices, type Invoice } from "./repository.server";
import { whatsappReminderLinkFor } from "./send.server";
import { channelsByCustomer, invoiceShortcuts } from "./shortcuts.server";

/** Données de la page Factures : à encaisser d'abord, avec le total dû et les retards. */

export interface FacturesPageData {
  readonly view: FacturesView;
  /** Factures de la vue choisie, les retards les plus anciens d'abord pour « À encaisser ». */
  readonly invoices: readonly InvoiceListItem[];
  readonly summary: FacturesSummary;
  readonly totalCount: number;
  readonly emailConfigured: boolean;
  readonly settingsComplete: boolean;
  /** Shopify n'a pas répondu : les factures sont toutes affichées « à payer » par prudence. */
  readonly statusError: string | null;
}

function orderPath(orderId: string): string | null {
  const gid = parseGid(orderId, "Order");
  return gid === null ? null : `/app/commandes/${gidToNumericId(gid)}`;
}

function toListItem(
  invoice: Invoice,
  financialStatus: string | null,
  sellerName: string | null,
  channels: ReturnType<typeof channelsByCustomer>,
  now: Date,
): InvoiceListItem {
  const situation = paymentSituation(invoice, financialStatus, swissIsoDate(now));
  return {
    ...invoiceShortcuts(invoice, sellerName, channels, now),
    orderName: invoice.orderName,
    orderPath: orderPath(invoice.orderId),
    customerName: invoice.customerName,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paidOn: invoice.paidOn,
    totalCents: invoice.totalCents,
    paymentState: situation.state,
    overdueDays: situation.overdueDays,
    reminderWhatsappUrl:
      situation.state === "en_retard" && sellerName !== null ? whatsappReminderLinkFor(invoice, sellerName, now) : null,
  };
}

function summarize(items: readonly InvoiceListItem[]): FacturesSummary {
  const unpaid = items.filter((item) => item.paymentState !== "payee");
  const overdue = unpaid.filter((item) => item.paymentState === "en_retard");
  const cents = (list: readonly InvoiceListItem[]) => list.reduce((sum, item) => sum + item.totalCents, 0);
  return { unpaidCount: unpaid.length, unpaidCents: cents(unpaid), overdueCount: overdue.length, overdueCents: cents(overdue) };
}

function forView(items: readonly InvoiceListItem[], view: FacturesView): InvoiceListItem[] {
  if (view === "toutes") return [...items];
  if (view === "payees") return items.filter((item) => item.paymentState === "payee");
  return items.filter((item) => item.paymentState !== "payee").sort((a, b) => b.overdueDays - a.overdueDays);
}

export async function loadFacturesPage(
  admin: AdminApiContext,
  shop: string,
  view: FacturesView,
  now: Date,
): Promise<FacturesPageData> {
  const [invoices, settings] = await Promise.all([listInvoices(shop), loadCompleteSettings(shop)]);
  const statuses = await loadPaymentStatuses(
    admin,
    invoices.filter((invoice) => invoice.paidOn === null).map((invoice) => invoice.orderId),
  );
  if (!statuses.ok) logError("Statuts de paiement illisibles", statuses.error, { shop });
  const sellerName = settings?.legalName ?? null;
  const channels = channelsByCustomer(invoices);
  const items = invoices.map((invoice) =>
    toListItem(invoice, statuses.ok ? (statuses.value.get(invoice.orderId) ?? null) : null, sellerName, channels, now),
  );
  return {
    view,
    invoices: forView(items, view),
    summary: summarize(items),
    totalCount: items.length,
    emailConfigured: isEmailConfigured(),
    settingsComplete: settings !== null,
    statusError: statuses.ok
      ? null
      : "Shopify ne répond pas\u202F: on ne sait pas encore quelles factures sont payées. Rechargez la page dans un instant.",
  };
}
