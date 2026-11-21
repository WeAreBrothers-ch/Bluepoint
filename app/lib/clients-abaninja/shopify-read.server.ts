import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { success, type Result } from "../core/result";
import type { ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { parseLink, parseUuidList, type AbaNinjaLink } from "./link";
import { toShopifyClient, type CustomerMatchNode, type ShopifyClient, type ShopifySide } from "./shopify-client";

/**
 * Tous les clients de la boutique (avec leurs liens AbaNinja et leurs entreprises), les entreprises qui portent
 * un lien et la liste des fiches mises de côté. Pages de 50 (coût de requête modéré) ; au-delà du plafond,
 * la liste est dite coupée.
 */

const PAGE_SIZE = 50;
const MAX_CUSTOMER_PAGES = 60;
const MAX_COMPANY_PAGES = 20;

const CLIENTS_QUERY = `#graphql
query ClientsPourAbaNinja($first: Int!, $after: String) {
  shop { id ignores: metafield(namespace: "$app", key: "abaninja_ignores") { value } }
  customers(first: $first, after: $after, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      displayName
      firstName
      lastName
      tags
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
      defaultAddress { company zip city }
      lien: metafield(namespace: "$app", key: "abaninja") { value }
      refus: metafield(namespace: "$app", key: "abaninja_refus") { value }
      companyContactProfiles {
        roleAssignments(first: 1) { nodes { id } }
        company { id name lien: metafield(namespace: "$app", key: "abaninja") { value } }
      }
    }
  }
}`;

const COMPANIES_QUERY = `#graphql
query EntreprisesPourAbaNinja($first: Int!, $after: String) {
  companies(first: $first, after: $after, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes { id lien: metafield(namespace: "$app", key: "abaninja") { value } }
  }
}`;

interface PageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

interface ClientsPageData {
  readonly shop: { readonly id: string; readonly ignores: { readonly value: string } | null };
  readonly customers: { readonly pageInfo: PageInfo; readonly nodes: readonly CustomerMatchNode[] };
}

interface CompaniesPageData {
  readonly companies: { readonly pageInfo: PageInfo; readonly nodes: readonly { readonly id: string; readonly lien: { readonly value: string } | null }[] };
}

type LinkedCompanies = ShopifySide["linkedCompanies"];

async function loadClients(admin: AdminApiContext) {
  const clients: ShopifyClient[] = [];
  let shop: ClientsPageData["shop"] | null = null;
  let after: string | null = null;
  for (let page = 1; page <= MAX_CUSTOMER_PAGES; page += 1) {
    const result: Result<ClientsPageData, ShopifyGraphqlError> = await runAdminGraphql<ClientsPageData>(admin, CLIENTS_QUERY, { first: PAGE_SIZE, after });
    if (!result.ok) return result;
    shop = result.value.shop;
    clients.push(...result.value.customers.nodes.map(toShopifyClient));
    const { hasNextPage, endCursor }: PageInfo = result.value.customers.pageInfo;
    if (!hasNextPage || endCursor === null) return success({ shop, clients, truncated: false });
    after = endCursor;
  }
  return success({ shop, clients, truncated: true });
}

/** Un échec ici ne bloque pas la page : on perd seulement la reprise d'une entreprise créée sans client. */
async function loadLinkedCompanies(admin: AdminApiContext): Promise<{ readonly companies: LinkedCompanies; readonly truncated: boolean }> {
  const companies: { companyId: string; link: AbaNinjaLink }[] = [];
  let after: string | null = null;
  for (let page = 1; page <= MAX_COMPANY_PAGES; page += 1) {
    const result: Result<CompaniesPageData, ShopifyGraphqlError> = await runAdminGraphql<CompaniesPageData>(admin, COMPANIES_QUERY, { first: PAGE_SIZE, after });
    if (!result.ok) {
      logError("Clients AbaNinja : entreprises illisibles", result.error);
      return { companies: [], truncated: false };
    }
    for (const node of result.value.companies.nodes) {
      const link = parseLink(node.lien?.value);
      if (link !== null) companies.push({ companyId: node.id, link });
    }
    const { hasNextPage, endCursor }: PageInfo = result.value.companies.pageInfo;
    if (!hasNextPage || endCursor === null) return { companies, truncated: false };
    after = endCursor;
  }
  return { companies, truncated: true };
}

export async function loadShopifySide(admin: AdminApiContext): Promise<Result<ShopifySide, ShopifyGraphqlError>> {
  const [clients, linked] = await Promise.all([loadClients(admin), loadLinkedCompanies(admin)]);
  if (!clients.ok) return clients;
  const { shop, truncated } = clients.value;
  logInfo("Clients AbaNinja : boutique lue", { clients: clients.value.clients.length, entreprisesReliees: linked.companies.length, coupee: truncated || linked.truncated });
  return success({
    shopId: shop?.id ?? "",
    clients: clients.value.clients,
    ignored: parseUuidList(shop?.ignores?.value),
    linkedCompanies: linked.companies,
    truncated: truncated || linked.truncated,
  });
}
