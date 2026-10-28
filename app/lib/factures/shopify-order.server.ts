import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ShopifyOrderForInvoice } from "@bluepoint/facture-qr";
import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import type { OrderGid } from "../shopify/ids";
import { InvoiceError } from "./errors";
import {
  INVOICE_CONTACT_QUERY,
  INVOICE_ORDER_QUERY,
  type InvoiceContactData,
  type InvoiceContactOrder,
  type InvoiceOrderData,
} from "./order-query";

/** Lecture (seule) de la commande à facturer dans Shopify. */

export interface OrderForInvoice {
  readonly order: ShopifyOrderForInvoice;
  readonly contact: InvoiceContactOrder;
}

export async function fetchOrderForInvoice(
  admin: AdminApiContext,
  orderId: OrderGid,
): Promise<Result<OrderForInvoice, InvoiceError>> {
  const [order, contact] = await Promise.all([
    runAdminGraphql<InvoiceOrderData>(admin, INVOICE_ORDER_QUERY, { id: orderId }),
    runAdminGraphql<InvoiceContactData>(admin, INVOICE_CONTACT_QUERY, { id: orderId }),
  ]);
  if (!order.ok || !contact.ok) {
    const error = !order.ok ? order.error : !contact.ok ? contact.error : null;
    logError("Lecture de la commande à facturer impossible", error, { orderId });
    return failure(new InvoiceError("shopify_indisponible"));
  }
  if (order.value.order === null || contact.value.order === null) {
    return failure(new InvoiceError("commande_introuvable"));
  }
  return success({ order: order.value.order, contact: contact.value.order });
}
