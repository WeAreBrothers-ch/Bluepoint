import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { CUSTOMER_FIELDS } from "../commande/queries";
import { runAdminGraphql } from "../shopify/graphql.server";
import {
  CLIENTS_PAGE_SIZE,
  CLIENT_STATS_FIELDS,
  cleanClientTerm,
  clientsSearchQuery,
  toClientListItem,
  type ClientListItem,
  type ClientStatsNode,
  type ClientsTab,
} from "./list";

/** Lecture de la liste des clients (par ordre alphabétique). */

const CLIENTS_LIST_QUERY = `
query ListeClients($first: Int!, $after: String, $query: String) {
  customers(first: $first, after: $after, query: $query, sortKey: NAME) {
    pageInfo { hasNextPage endCursor }
    nodes {${CUSTOMER_FIELDS}${CLIENT_STATS_FIELDS}
    }
  }
}`;

interface ClientsListData {
  readonly customers: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly ClientStatsNode[];
  };
}

export interface ClientsPageData {
  readonly tab: ClientsTab;
  readonly term: string;
  readonly items: readonly ClientListItem[];
  readonly nextCursor: string | null;
  readonly loadError: string | null;
  /** Demandes de compte pro à valider (le bouton de la page y mène). */
  readonly pendingProRequests: number;
}

export async function loadClientsPage(
  admin: AdminApiContext,
  tab: ClientsTab,
  rawTerm: string,
  cursor: string | null,
  pendingProRequests: number,
): Promise<ClientsPageData> {
  const term = cleanClientTerm(rawTerm);
  const query = clientsSearchQuery(tab, term);
  const result = await runAdminGraphql<ClientsListData>(admin, CLIENTS_LIST_QUERY, {
    first: CLIENTS_PAGE_SIZE,
    after: cursor,
    query: query === "" ? null : query,
  });
  if (!result.ok) {
    logError("Liste des clients impossible", result.error, { tab });
    return {
      tab,
      term,
      items: [],
      nextCursor: null,
      loadError: "Les clients n’ont pas pu être chargés. Rechargez la page dans un instant.",
      pendingProRequests,
    };
  }
  const items = result.value.customers.nodes.flatMap((node) => toClientListItem(node) ?? []);
  const { hasNextPage, endCursor } = result.value.customers.pageInfo;
  return { tab, term, items, nextCursor: hasNextPage ? endCursor : null, loadError: null, pendingProRequests };
}
