import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import type { ShopifyRequestError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { collectPages, type Page } from "../shopify/paginate";
import { orderToTask } from "./mapping";
import { AGENDA_MAX_ORDERS, AGENDA_ORDERS_QUERY, AGENDA_PAGE_SIZE, type AgendaOrderNode, type AgendaOrdersData } from "./query";
import { fulfilledOrdersSearch, openOrdersSearch } from "./search";
import type { DateRange, DeliveryTask } from "./types";

/** Charge les commandes de l'agenda depuis l'Admin API (lecture seule). */

export interface AgendaOrders {
  readonly tasks: readonly DeliveryTask[];
  /** Le plafond de commandes a été atteint : l'agenda est incomplet. */
  readonly truncated: boolean;
}

function pageFetcher(admin: AdminApiContext, query: string) {
  return async (after: string | null, first: number): Promise<Result<Page<AgendaOrderNode>, ShopifyRequestError>> => {
    const result = await runAdminGraphql<AgendaOrdersData>(admin, AGENDA_ORDERS_QUERY, { first, after, query });
    if (!result.ok) return result;
    const { nodes, pageInfo } = result.value.orders;
    return success({ items: nodes, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor });
  };
}

function uniqueTasks(nodes: readonly AgendaOrderNode[]): DeliveryTask[] {
  const byId = new Map<string, DeliveryTask>();
  for (const node of nodes) {
    const task = orderToTask(node);
    if (task !== null) byId.set(task.orderId, task);
  }
  return [...byId.values()];
}

export async function loadAgendaOrders(
  admin: AdminApiContext,
  week: DateRange,
): Promise<Result<AgendaOrders, ShopifyRequestError>> {
  const half = AGENDA_MAX_ORDERS / 2;
  const open = await collectPages(pageFetcher(admin, openOrdersSearch()), AGENDA_PAGE_SIZE, half);
  if (!open.ok) return failure(open.error);
  const done = await collectPages(pageFetcher(admin, fulfilledOrdersSearch(week)), AGENDA_PAGE_SIZE, half);
  if (!done.ok) return failure(done.error);
  return success({
    tasks: uniqueTasks([...open.value.items, ...done.value.items]),
    truncated: open.value.truncated || done.value.truncated,
  });
}
