import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import type { ShopifyRequestError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { collectPages, type Page } from "../shopify/paginate";
import { toProductOptions } from "./catalog";
import { toCustomerOptions, toShippingAddress } from "./customers";
import { pickFulfillmentTemplate, pickNetTemplate, type ChosenTemplate } from "./payload";
import {
  CATALOG_MAX_VARIANTS,
  CATALOG_PAGE_SIZE,
  CATALOG_QUERY,
  CUSTOMER_ADDRESS_QUERY,
  CUSTOMER_SEARCH_LIMIT,
  CUSTOMER_SEARCH_QUERY,
  CUSTOMER_SEARCH_QUERY_WITHOUT_B2B,
  PAYMENT_TERMS_TEMPLATES_QUERY,
  type CatalogData,
  type CustomerAddressData,
  type CustomerSearchData,
  type PaymentTermsTemplatesData,
  type VariantNode,
} from "./queries";
import type { CustomerGid, CustomerOption, ProductOption, ShippingAddress } from "./types";

/** Lectures Admin API de la commande par téléphone (aucune écriture ici). */

/** Recherche avec les profils B2B ; si la boutique les refuse, nouvelle recherche sans B2B. */
export async function searchCustomers(
  admin: AdminApiContext,
  term: string,
): Promise<Result<CustomerOption[], ShopifyRequestError>> {
  const variables = { first: CUSTOMER_SEARCH_LIMIT, query: term };
  const withB2b = await runAdminGraphql<CustomerSearchData>(admin, CUSTOMER_SEARCH_QUERY, variables);
  if (withB2b.ok) return success(toCustomerOptions(withB2b.value.customers.nodes));
  logError("Recherche client avec B2B refusée, nouvel essai sans B2B", withB2b.error);
  const basic = await runAdminGraphql<CustomerSearchData>(admin, CUSTOMER_SEARCH_QUERY_WITHOUT_B2B, variables);
  return basic.ok ? success(toCustomerOptions(basic.value.customers.nodes)) : failure(basic.error);
}

export interface Catalog {
  readonly products: readonly ProductOption[];
  /** Plus de variantes actives que le plafond : la liste est incomplète. */
  readonly truncated: boolean;
}

function catalogPage(admin: AdminApiContext) {
  return async (after: string | null, first: number): Promise<Result<Page<VariantNode>, ShopifyRequestError>> => {
    const result = await runAdminGraphql<CatalogData>(admin, CATALOG_QUERY, { first, after });
    if (!result.ok) return result;
    const { nodes, pageInfo } = result.value.productVariants;
    return success({ items: nodes, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor });
  };
}

export async function loadCatalog(admin: AdminApiContext): Promise<Result<Catalog, ShopifyRequestError>> {
  const pages = await collectPages(catalogPage(admin), CATALOG_PAGE_SIZE, CATALOG_MAX_VARIANTS);
  if (!pages.ok) return pages;
  return success({ products: toProductOptions(pages.value.items), truncated: pages.value.truncated });
}

/** Adresse par défaut du client, relue chez Shopify. `null` si le client n'en a pas. */
export async function loadCustomerAddress(
  admin: AdminApiContext,
  customerId: CustomerGid,
): Promise<Result<{ readonly found: boolean; readonly address: ShippingAddress | null }, ShopifyRequestError>> {
  const result = await runAdminGraphql<CustomerAddressData>(admin, CUSTOMER_ADDRESS_QUERY, { id: customerId });
  if (!result.ok) return result;
  const customer = result.value.customer;
  return success({ found: customer !== null, address: toShippingAddress(customer?.defaultAddress ?? null) });
}

/**
 * Modèle de conditions de paiement : « net N jours » (sur facture) ou « à l'expédition »
 * (à la livraison). `null` si la lecture est refusée (autorisation `read_payment_terms`
 * absente, offre sans conditions de paiement…).
 */
export async function findPaymentTemplate(
  admin: AdminApiContext,
  payment: "facture" | "a_la_livraison",
  days: number,
): Promise<ChosenTemplate | null> {
  const result = await runAdminGraphql<PaymentTermsTemplatesData>(admin, PAYMENT_TERMS_TEMPLATES_QUERY);
  if (!result.ok) {
    logError("Modèles de conditions de paiement illisibles", result.error, { days, payment });
    return null;
  }
  const templates = result.value.paymentTermsTemplates;
  return payment === "facture" ? pickNetTemplate(templates, days) : pickFulfillmentTemplate(templates);
}
