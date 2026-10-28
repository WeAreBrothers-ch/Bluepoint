import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { toCustomerOption } from "./customers";
import { toCustomerInput, type NewCustomerInput } from "./new-customer";
import { CUSTOMER_FIELDS, type CustomerNode } from "./queries";
import type { CustomerOption } from "./types";

/** Crée la fiche d'un nouveau client dans Shopify (Admin API 2026-10, `write_customers`). */

const CUSTOMER_CREATE_MUTATION = `#graphql
mutation NouveauClient($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer {${CUSTOMER_FIELDS}
    }
    userErrors { field message }
  }
}`;

interface CustomerCreateData {
  readonly customerCreate: {
    readonly customer: CustomerNode | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}

export class NewCustomerError extends Error {
  override readonly name = "NewCustomerError";
}

export async function createCustomer(admin: AdminApiContext, input: NewCustomerInput): Promise<Result<CustomerOption, NewCustomerError>> {
  const created = await runAdminMutation(admin, CUSTOMER_CREATE_MUTATION, (data: CustomerCreateData) => data.customerCreate, {
    input: toCustomerInput(input),
  });
  if (!created.ok) {
    logError("Nouveau client non créé", created.error);
    const plain = created.error instanceof ShopifyUserErrors ? plainShopifyRefusal(created.error.message) : null;
    return failure(new NewCustomerError(plain ?? "La fiche n’a pas pu être créée. Réessayez dans un instant."));
  }
  const customer = created.value.customer === null ? null : toCustomerOption(created.value.customer);
  if (customer === null) return failure(new NewCustomerError("La fiche n’a pas pu être créée. Réessayez dans un instant."));
  logInfo("Nouveau client créé depuis « Prendre une commande »", { customerId: customer.id });
  return success(customer);
}
