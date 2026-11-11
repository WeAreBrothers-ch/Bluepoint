import { paymentSituation, type PaymentState } from "../factures/payment";
import { invoicesByOrder } from "../factures/repository.server";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { AGENDA_ORDER_FIELDS } from "../agenda/query";
import { logError } from "../core/logger.server";
import { toOrderListItem, type OrderListItem, type OrderListNode } from "../commandes/list";
import { CUSTOMER_FIELDS } from "../commande/queries";
import { runAdminGraphql } from "../shopify/graphql.server";
import { CLIENT_STATS_FIELDS, toClientListItem, type ClientListItem, type ClientStatsNode } from "./list";

/** Fiche d'un client : coordonnées, adresse, ses commandes récentes. */

/** Nombre de commandes récentes montrées sur la fiche. */
export const CLIENT_ORDERS_SHOWN = 10;

const CLIENT_QUERY = `
query FicheClient($id: ID!) {
  customer(id: $id) {${CUSTOMER_FIELDS}${CLIENT_STATS_FIELDS}
    defaultAddress { id }
    orders(first: ${CLIENT_ORDERS_SHOWN}, sortKey: PROCESSED_AT, reverse: true) {
      nodes {${AGENDA_ORDER_FIELDS}
        createdAt
      }
    }
  }
}`;

interface ClientNode extends ClientStatsNode {
  readonly defaultAddress: (ClientStatsNode["defaultAddress"] & { readonly id: string }) | null;
  readonly orders: { readonly nodes: readonly OrderListNode[] };
}

interface ClientData {
  readonly customer: ClientNode | null;
}

export interface ClientInvoice {
  readonly id: string;
  readonly number: string;
  readonly orderName: string;
  readonly totalCents: number;
  readonly state: PaymentState;
  readonly overdueDays: number;
}

export interface ClientPageData {
  readonly client: ClientListItem | null;
  /** Identifiant de l'adresse par défaut, pour la modifier. */
  readonly addressId: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly orders: readonly OrderListItem[];
  /** Factures de ses dernières commandes, avec ce qui reste à payer. */
  readonly invoices: readonly ClientInvoice[];
  /** Message si le client n'a pas pu être lu. */
  readonly problem: string | null;
}

const NOT_FOUND = "Ce client n’existe plus ou n’a pas pu être ouvert.";

function empty(problem: string): ClientPageData {
  return { client: null, addressId: null, firstName: "", lastName: "", orders: [], invoices: [], problem };
}

export async function loadClientPage(admin: AdminApiContext, shop: string, numericId: string, now: Date): Promise<ClientPageData> {
  if (!/^\d{1,20}$/.test(numericId)) return empty(NOT_FOUND);
  const result = await runAdminGraphql<ClientData>(admin, CLIENT_QUERY, { id: `gid://shopify/Customer/${numericId}` });
  if (!result.ok) {
    logError("Fiche client illisible", result.error, { numericId });
    return empty("Le client n’a pas pu être chargé. Rechargez la page dans un instant.");
  }
  const node = result.value.customer;
  if (node === null) return empty(NOT_FOUND);
  const client = toClientListItem(node);
  if (client === null) return empty(NOT_FOUND);
  const today = swissIsoDate(now);
  const orders = node.orders.nodes;
  const invoices = await invoicesByOrder(shop, orders.map((order) => order.id));
  const clientInvoices = orders.flatMap((order): ClientInvoice[] => {
    const invoice = invoices.get(order.id);
    if (invoice === undefined) return [];
    const situation = paymentSituation(invoice, order.displayFinancialStatus ?? null, today);
    return [{ id: invoice.id, number: invoice.number, orderName: invoice.orderName, totalCents: invoice.totalCents, state: situation.state, overdueDays: situation.overdueDays }];
  });
  return {
    client,
    addressId: node.defaultAddress?.id ?? null,
    firstName: node.firstName ?? "",
    lastName: node.lastName ?? "",
    orders: orders.flatMap((order) => toOrderListItem(order, today) ?? []),
    invoices: clientInvoices,
    problem: null,
  };
}
