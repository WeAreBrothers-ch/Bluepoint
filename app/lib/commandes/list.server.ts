import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { AGENDA_ORDER_FIELDS } from "../agenda/query";
import { logError } from "../core/logger.server";
import { runAdminGraphql } from "../shopify/graphql.server";
import {
  ORDERS_PAGE_SIZE,
  cleanSearchTerm,
  ordersSearchQuery,
  toOrderListItem,
  type OrderListItem,
  type OrderListNode,
  type OrdersTab,
} from "./list";

/** Lecture de la liste des commandes (les plus récentes d'abord). */

const ORDERS_LIST_QUERY = `#graphql
query ListeCommandes($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT, reverse: true) {
    pageInfo { hasNextPage endCursor }
    nodes {${AGENDA_ORDER_FIELDS}
      createdAt
    }
  }
}`;

interface OrdersListData {
  readonly orders: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly OrderListNode[];
  };
}

export interface OrdersPageData {
  readonly tab: OrdersTab;
  /** Ce qui a été tapé dans la recherche (nettoyé). */
  readonly term: string;
  readonly items: readonly OrderListItem[];
  /** Curseur de la page suivante, ou null s'il n'y en a pas. */
  readonly nextCursor: string | null;
  readonly loadError: string | null;
}

export async function loadOrdersPage(
  admin: AdminApiContext,
  tab: OrdersTab,
  rawTerm: string,
  cursor: string | null,
  now: Date,
): Promise<OrdersPageData> {
  const term = cleanSearchTerm(rawTerm);
  const query = ordersSearchQuery(tab, term);
  const result = await runAdminGraphql<OrdersListData>(admin, ORDERS_LIST_QUERY, {
    first: ORDERS_PAGE_SIZE,
    after: cursor,
    query: query === "" ? null : query,
  });
  if (!result.ok) {
    logError("Liste des commandes impossible", result.error, { tab });
    return { tab, term, items: [], nextCursor: null, loadError: "Les commandes n’ont pas pu être chargées. Rechargez la page dans un instant." };
  }
  const today = swissIsoDate(now);
  const items = result.value.orders.nodes.flatMap((node) => toOrderListItem(node, today) ?? []);
  const { hasNextPage, endCursor } = result.value.orders.pageInfo;
  return { tab, term, items, nextCursor: hasNextPage ? endCursor : null, loadError: null };
}
