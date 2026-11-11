import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { logError } from "../core/logger.server";
import { success, type Result } from "../core/result";
import { loadCompleteSettings } from "../reglages/settings.server";
import { grantedScopes } from "../shopify/access.server";
import type { ShopifyRequestError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { collectPages, type Page } from "../shopify/paginate";
import { buildReport, type LitresReport, type SoldLine } from "./report";

/**
 * Litres vendus : lit les commandes de l'année dans Shopify, puis additionne (report.ts).
 * Ne compte pas les commandes annulées ni les commandes d'essai. Une ligne retirée d'une commande
 * modifiée n'est pas comptée (quantité actuelle). Les remboursements ne sont pas déduits.
 */

export const ALL_ORDERS_SCOPE = "read_all_orders";
/** Sans `read_all_orders`, Shopify ne donne que les 60 derniers jours. */
const DEFAULT_HISTORY_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Petites pages : Shopify refuse une requête dont le coût demandé dépasse 1000. */
const ORDERS_PAGE_SIZE = 20;
const LINES_PER_ORDER = 20;
const MAX_ORDERS = 3000;

const PRODUCT_FIELDS = "product { id title vendor productType tags }";

const ORDERS_QUERY = `#graphql
query LitresVendus($first: Int!, $after: String, $query: String!) {
  orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      createdAt
      cancelledAt
      test
      lineItems(first: ${LINES_PER_ORDER}) {
        pageInfo { hasNextPage endCursor }
        nodes { title currentQuantity ${PRODUCT_FIELDS} }
      }
    }
  }
}`;

const MORE_LINES_QUERY = `#graphql
query LitresLignesSuivantes($id: ID!, $after: String) {
  order(id: $id) {
    lineItems(first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { title currentQuantity ${PRODUCT_FIELDS} }
    }
  }
}`;

interface LineNode {
  readonly title: string;
  readonly currentQuantity: number;
  readonly product: {
    readonly id: string;
    readonly title: string;
    readonly vendor: string | null;
    readonly productType: string | null;
    readonly tags: readonly string[];
  } | null;
}

interface LinesConnection {
  readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
  readonly nodes: readonly LineNode[];
}

interface OrderNode {
  readonly id: string;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
  readonly test: boolean;
  readonly lineItems: LinesConnection;
}

interface OrdersData {
  readonly orders: { readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null }; readonly nodes: readonly OrderNode[] };
}

interface MoreLinesData {
  readonly order: { readonly lineItems: LinesConnection } | null;
}

/** Années proposées : l'année en cours et les trois précédentes. */
export function availableYears(now: Date): number[] {
  const current = Number(swissIsoDate(now).slice(0, 4));
  return [current, current - 1, current - 2, current - 3];
}

/** L'année demandée si elle est proposée, sinon l'année en cours. */
export function parseYear(raw: string | null, now: Date): number {
  const years = availableYears(now);
  const asked = raw !== null && /^\d{4}$/.test(raw) ? Number(raw) : null;
  return asked !== null && years.includes(asked) ? asked : (years[0] ?? asked ?? 0);
}

/** Le 1er janvier est toujours en heure d'hiver suisse (UTC+1) : minuit suisse = 23 h la veille, en UTC. */
export function yearBounds(year: number): { readonly start: string; readonly end: string } {
  return { start: `${year - 1}-12-31T23:00:00Z`, end: `${year}-12-31T23:00:00Z` };
}

function toSoldLines(order: OrderNode, extra: readonly LineNode[]): SoldLine[] {
  const month = Number(swissIsoDate(new Date(order.createdAt)).slice(5, 7));
  return [...order.lineItems.nodes, ...extra].map((node) => ({
    productId: node.product?.id ?? null,
    title: node.product?.title ?? node.title,
    vendor: node.product?.vendor ?? null,
    productType: node.product?.productType ?? null,
    tags: node.product?.tags ?? [],
    bottles: node.currentQuantity,
    month,
  }));
}

/** Les lignes d'une grosse commande au-delà des premières : lues à part, pour ne rien oublier. */
async function moreLines(admin: AdminApiContext, order: OrderNode): Promise<Result<LineNode[], ShopifyRequestError>> {
  const lines: LineNode[] = [];
  let after = order.lineItems.pageInfo.endCursor;
  let more = order.lineItems.pageInfo.hasNextPage;
  while (more) {
    const result = await runAdminGraphql<MoreLinesData>(admin, MORE_LINES_QUERY, { id: order.id, after });
    if (!result.ok) return result;
    const connection = result.value.order?.lineItems;
    if (connection === undefined) break;
    lines.push(...connection.nodes);
    more = connection.pageInfo.hasNextPage && connection.pageInfo.endCursor !== null;
    after = connection.pageInfo.endCursor;
  }
  return success(lines);
}

function ordersPage(admin: AdminApiContext, query: string) {
  return async (after: string | null, first: number): Promise<Result<Page<OrderNode>, ShopifyRequestError>> => {
    const result = await runAdminGraphql<OrdersData>(admin, ORDERS_QUERY, { first, after, query });
    if (!result.ok) return result;
    const { nodes, pageInfo } = result.value.orders;
    return success({ items: nodes, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor });
  };
}

export interface LitresPageData {
  readonly year: number;
  readonly years: readonly number[];
  readonly report: LitresReport | null;
  readonly loadError: string | null;
  /** Vrai si Shopify ne donne que les 60 derniers jours : le total de l'année est alors incomplet. */
  readonly partial: boolean;
  /** Vrai si le nombre de commandes dépasse ce que la page sait lire d'un coup. */
  readonly truncated: boolean;
  readonly orderCount: number;
  /** Nom de l'entreprise, pour l'en-tête de la feuille à imprimer. */
  readonly sellerName: string | null;
  /** Instant de la lecture, pour la feuille à imprimer. */
  readonly generatedAt: string;
}

export async function loadLitresPage(admin: AdminApiContext, shop: string, rawYear: string | null, now: Date): Promise<LitresPageData> {
  const year = parseYear(rawYear, now);
  const years = availableYears(now);
  const { start, end } = yearBounds(year);
  const base = { year, years, generatedAt: now.toISOString() };
  const [scopes, settings] = await Promise.all([grantedScopes(admin), loadCompleteSettings(shop)]);
  const sellerName = settings?.legalName ?? null;
  const partial = scopes !== null && !scopes.has(ALL_ORDERS_SCOPE) && new Date(start).getTime() < now.getTime() - DEFAULT_HISTORY_DAYS * DAY_MS;

  const orders = await collectPages(ordersPage(admin, `created_at:>=${start} created_at:<${end}`), ORDERS_PAGE_SIZE, MAX_ORDERS);
  if (!orders.ok) {
    logError("Litres vendus : commandes illisibles", orders.error, { year });
    return { ...base, report: null, loadError: "Shopify ne répond pas pour le moment. Rechargez la page dans un instant.", partial, truncated: false, orderCount: 0, sellerName };
  }
  const counted = orders.value.items.filter((order) => !order.test && order.cancelledAt === null);
  const lines: SoldLine[] = [];
  for (const order of counted) {
    const extra = order.lineItems.pageInfo.hasNextPage ? await moreLines(admin, order) : success<LineNode[]>([]);
    if (!extra.ok) {
      logError("Litres vendus : lignes d'une commande illisibles", extra.error, { year });
      return { ...base, report: null, loadError: "Shopify ne répond pas pour le moment. Rechargez la page dans un instant.", partial, truncated: false, orderCount: 0, sellerName };
    }
    lines.push(...toSoldLines(order, extra.value));
  }
  return { ...base, report: buildReport(lines), loadError: null, partial, truncated: orders.value.truncated, orderCount: counted.length, sellerName };
}
