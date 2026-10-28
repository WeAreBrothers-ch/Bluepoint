import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { loadPaymentTerms } from "../agenda/payment-terms.server";
import type { InvoiceRef } from "../agenda/types";
import { logError } from "../core/logger.server";
import { isEmailConfigured } from "../factures/email.server";
import { findInvoiceByOrder, listInvoices } from "../factures/repository.server";
import { channelsByCustomer, invoiceShortcuts } from "../factures/shortcuts.server";
import type { IsoDate } from "../metafields/definitions";
import { loadCompleteSettings } from "../reglages/settings.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import { grantedScopes } from "../shopify/access.server";
import { loadCatalog } from "../commande/reads.server";
import type { ProductOption } from "../commande/types";
import { changeRules, type ChangeRules } from "./change";
import { ORDER_EDIT_SCOPE } from "./change.server";
import { ORDER_DETAIL_QUERY, toOrderDetail, type OrderDetail, type OrderDetailNode } from "./detail";

/** Données de la fiche commande (`/app/commandes/:id`, id numérique de Shopify). */

/** « Modifier les vins » et « Annuler la commande » : ce qui est permis, et les vins à proposer. */
export interface OrderChangeData {
  readonly rules: ChangeRules;
  /** Vins en vente, chargés seulement si la commande peut être modifiée. */
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
}

export interface OrderPageData {
  readonly detail: OrderDetail | null;
  readonly change: OrderChangeData | null;
  readonly invoice: InvoiceRef | null;
  readonly today: IsoDate;
  readonly emailConfigured: boolean;
  /** Message simple si la commande n'a pas pu être lue. */
  readonly problem: string | null;
}

export async function loadOrderPage(admin: AdminApiContext, shop: string, numericId: string, now: Date): Promise<OrderPageData> {
  const today = swissIsoDate(now);
  const base = { today, emailConfigured: isEmailConfigured(), change: null };
  if (!/^\d+$/.test(numericId)) return { ...base, detail: null, invoice: null, problem: "Cette commande n’existe pas." };
  const orderId = `gid://shopify/Order/${numericId}`;
  const result = await runAdminGraphql<{ readonly order: OrderDetailNode | null }>(admin, ORDER_DETAIL_QUERY, { id: orderId });
  if (!result.ok) {
    logError("Fiche commande illisible", result.error, { orderId });
    return { ...base, detail: null, invoice: null, problem: "Shopify ne répond pas pour le moment. Rechargez la page dans un instant." };
  }
  const node = result.value.order;
  if (node === null) return { ...base, detail: null, invoice: null, problem: "Cette commande n’existe plus dans Shopify." };

  const [terms, stored, settings] = await Promise.all([
    node.displayFinancialStatus === "PENDING" ? loadPaymentTerms(admin, [orderId]) : Promise.resolve(new Map()),
    findInvoiceByOrder(orderId),
    loadCompleteSettings(shop),
  ]);
  const detail = toOrderDetail(node, terms.get(orderId) ?? null, today);
  if (detail === null) return { ...base, detail: null, invoice: null, problem: "Cette commande a été annulée : rien à livrer." };
  const invoice =
    stored === null || stored.shop !== shop
      ? null
      : invoiceShortcuts(stored, settings?.legalName ?? null, channelsByCustomer(await listInvoices(shop)), now);
  const rules = changeRules({
    cancelled: node.cancelledAt !== null,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    hasInvoice: stored !== null,
  });
  return { ...base, detail, invoice, problem: null, change: await changeData(admin, rules) };
}

/** Pour modifier les vins : l'autorisation « modifier les commandes » et la liste des vins en vente. */
async function changeData(admin: AdminApiContext, rules: ChangeRules): Promise<OrderChangeData> {
  if (!rules.canEdit) return { rules, products: [], truncated: false };
  const [catalog, scopes] = await Promise.all([loadCatalog(admin), grantedScopes(admin)]);
  if (scopes !== null && !scopes.has(ORDER_EDIT_SCOPE)) {
    const editBlocked = "Une étape d’autorisation reste à faire dans Shopify avant de pouvoir modifier les vins ici. L’annulation, elle, marche déjà.";
    return { rules: { ...rules, canEdit: false, editBlocked }, products: [], truncated: false };
  }
  if (!catalog.ok) {
    logError("Vins illisibles pour la modification", catalog.error);
    const editBlocked = "La liste des vins ne s’affiche pas pour le moment. Rechargez la page dans un instant.";
    return { rules: { ...rules, canEdit: false, editBlocked }, products: [], truncated: false };
  }
  return { rules, products: catalog.value.products, truncated: catalog.value.truncated };
}
