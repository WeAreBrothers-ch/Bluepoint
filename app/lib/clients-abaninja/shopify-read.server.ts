import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logInfo } from "../core/logger.server";
import { success, type Result } from "../core/result";
import type { ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { parseUuidList } from "./link";
import { toShopifyClient, type CustomerMatchNode, type ShopifyClient, type ShopifySide } from "./shopify-client";

/**
 * Tous les clients de la boutique (avec leurs liens AbaNinja et leurs entreprises) et la liste des fiches
 * mises de côté. Pages de 50 (coût de requête modéré), 60 pages au plus : au-delà, la liste est dite coupée.
 */

const PAGE_SIZE = 50;
const MAX_PAGES = 60;

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
      companyContactProfiles { company { id name lien: metafield(namespace: "$app", key: "abaninja") { value } } }
    }
  }
}`;

interface ClientsPageData {
  readonly shop: { readonly id: string; readonly ignores: { readonly value: string } | null };
  readonly customers: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly CustomerMatchNode[];
  };
}

export async function loadShopifySide(admin: AdminApiContext): Promise<Result<ShopifySide, ShopifyGraphqlError>> {
  const clients: ShopifyClient[] = [];
  let shop: ClientsPageData["shop"] | null = null;
  let after: string | null = null;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result: Result<ClientsPageData, ShopifyGraphqlError> = await runAdminGraphql<ClientsPageData>(admin, CLIENTS_QUERY, {
      first: PAGE_SIZE,
      after,
    });
    if (!result.ok) return result;
    shop = result.value.shop;
    clients.push(...result.value.customers.nodes.map(toShopifyClient));
    const { hasNextPage, endCursor }: ClientsPageData["customers"]["pageInfo"] = result.value.customers.pageInfo;
    if (!hasNextPage || endCursor === null) return success(toSide(shop, clients, false));
    after = endCursor;
  }
  logInfo("Clients AbaNinja : liste des clients Shopify coupée", { clients: clients.length });
  return success(toSide(shop, clients, true));
}

function toSide(shop: ClientsPageData["shop"] | null, clients: readonly ShopifyClient[], truncated: boolean): ShopifySide {
  return { shopId: shop?.id ?? "", clients, ignored: parseUuidList(shop?.ignores?.value), truncated };
}
