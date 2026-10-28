import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { findInvoiceByOrder, listInvoices } from "../factures/repository.server";
import { channelsByCustomer, invoiceShortcuts } from "../factures/shortcuts.server";
import { loadCompleteSettings } from "../reglages/settings.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { swissIsoDate } from "./dates";
import { orderToTask } from "./mapping";
import { loadPaymentTerms } from "./payment-terms.server";
import { AGENDA_ORDER_QUERY, type AgendaOrderNode } from "./query";
import { CANCELLED_SUMMARY, orderSummary, type OrderSummary } from "./summary";
import { scheduleTask } from "./urgency";

/** Résumé BluePoint d'une commande (cadre de la page de commande Shopify). `null` : commande introuvable. */
export async function loadOrderSummary(admin: AdminApiContext, shop: string, rawOrderId: string, now: Date): Promise<OrderSummary | null> {
  const orderId = parseGid(rawOrderId, "Order");
  if (orderId === null) return null;
  const result = await runAdminGraphql<{ readonly order: AgendaOrderNode | null }>(admin, AGENDA_ORDER_QUERY, { id: orderId });
  if (!result.ok) throw result.error;
  if (result.value.order === null) return null;
  const task = orderToTask(result.value.order);
  if (task === null) return CANCELLED_SUMMARY;

  const [terms, stored, settings] = await Promise.all([
    task.financialStatus === "PENDING" ? loadPaymentTerms(admin, [orderId]) : Promise.resolve(new Map()),
    findInvoiceByOrder(orderId),
    loadCompleteSettings(shop),
  ]);
  const scheduled = scheduleTask({ ...task, paymentTerms: terms.get(orderId) ?? null }, swissIsoDate(now));
  const invoice =
    stored === null || stored.shop !== shop
      ? null
      : invoiceShortcuts(stored, settings?.legalName ?? null, channelsByCustomer(await listInvoices(shop)), now);
  return orderSummary(scheduled, swissIsoDate(now), invoice === null ? null : { number: invoice.number, viewUrl: invoice.viewUrl });
}
