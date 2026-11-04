import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import type { NewCustomerInput } from "../commande/new-customer";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";

/** Modifie les coordonnées d'un client dans Shopify (Admin API, `write_customers`). */

const CUSTOMER_UPDATE_MUTATION = `#graphql
mutation ModifierClient($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

const ADDRESS_UPDATE_MUTATION = `#graphql
mutation ModifierAdresse($customerId: ID!, $addressId: ID!, $address: MailingAddressInput!) {
  customerAddressUpdate(customerId: $customerId, addressId: $addressId, address: $address, setAsDefault: true) {
    address { id }
    userErrors { field message }
  }
}`;

const ADDRESS_CREATE_MUTATION = `#graphql
mutation AjouterAdresse($customerId: ID!, $address: MailingAddressInput!) {
  customerAddressCreate(customerId: $customerId, address: $address, setAsDefault: true) {
    address { id }
    userErrors { field message }
  }
}`;

interface UserErrorsPayload {
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
}

interface UpdateData {
  readonly customerUpdate: UserErrorsPayload | null;
}
interface AddressUpdateData {
  readonly customerAddressUpdate: UserErrorsPayload | null;
}
interface AddressCreateData {
  readonly customerAddressCreate: UserErrorsPayload | null;
}

export class ClientEditError extends Error {
  override readonly name = "ClientEditError";
}

const FAILED = "Les coordonnées n’ont pas pu être enregistrées. Réessayez dans un instant.";

function explain(error: unknown, fallback: string): ClientEditError {
  const plain = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  return new ClientEditError(plain ?? fallback);
}

/** Le nom, le téléphone et l'e-mail d'abord, puis l'adresse (seulement si une rue est indiquée). */
export async function updateClient(
  admin: AdminApiContext,
  numericId: string,
  addressId: string | null,
  input: NewCustomerInput,
): Promise<Result<true, ClientEditError>> {
  const customerId = `gid://shopify/Customer/${numericId}`;
  const updated = await runAdminMutation(admin, CUSTOMER_UPDATE_MUTATION, (data: UpdateData) => data.customerUpdate, {
    input: {
      id: customerId,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      ...(input.email === null ? {} : { email: input.email }),
    },
  });
  if (!updated.ok) {
    logError("Client non modifié", updated.error, { numericId });
    return failure(explain(updated.error, FAILED));
  }
  if (input.street === "") return success(true);

  const address = {
    firstName: input.firstName,
    lastName: input.lastName,
    company: input.company,
    address1: input.street,
    zip: input.postalCode,
    city: input.city,
    countryCode: "CH",
    phone: input.phone,
  };
  const saved =
    addressId === null
      ? await runAdminMutation(admin, ADDRESS_CREATE_MUTATION, (data: AddressCreateData) => data.customerAddressCreate, { customerId, address })
      : await runAdminMutation(admin, ADDRESS_UPDATE_MUTATION, (data: AddressUpdateData) => data.customerAddressUpdate, {
          customerId,
          addressId,
          address,
        });
  if (!saved.ok) {
    logError("Adresse du client non modifiée", saved.error, { numericId });
    return failure(explain(saved.error, "Le nom et le téléphone sont enregistrés, mais pas l’adresse. Réessayez dans un instant."));
  }
  return success(true);
}
