import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { ShopifyRequestError, type ShopifyGraphqlError, type ShopifyUserError } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import type { MailingAddress, PersonCustomerInput } from "./card-inputs";
import { ABANINJA_NAMESPACE, IGNORED_KEY, LINK_KEY, REFUSED_KEY, serializeLink, serializeUuidList, type AbaNinjaLink } from "./link";
import type { ShopifyClient } from "./shopify-client";

/** Écritures Shopify de la page « Clients AbaNinja » (Admin API 2026-10, `write_customers`). */

const METAFIELDS_SET = `#graphql
mutation LienAbaNinja($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id }
    userErrors { field message code }
  }
}`;

const CUSTOMER_CREATE = `#graphql
mutation ClientDepuisAbaNinja($input: CustomerInput!) {
  customerCreate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

const ADDRESS_CREATE = `#graphql
mutation AdresseDepuisAbaNinja($customerId: ID!, $address: MailingAddressInput!) {
  customerAddressCreate(customerId: $customerId, address: $address, setAsDefault: true) {
    address { id }
    userErrors { field message }
  }
}`;

const CUSTOMER_UPDATE = `#graphql
mutation TelephoneDepuisAbaNinja($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

const TAGS_ADD = `#graphql
mutation EtiquetteProAbaNinja($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    userErrors { field message }
  }
}`;

interface Payload {
  readonly userErrors: readonly ShopifyUserError[];
}

type Done = Result<void, ShopifyGraphqlError>;

function json(ownerId: string, key: string, value: string) {
  return { ownerId, namespace: ABANINJA_NAMESPACE, key, type: "json", value };
}

async function setMetafields(admin: AdminApiContext, metafields: readonly ReturnType<typeof json>[]): Promise<Done> {
  const result = await runAdminMutation(admin, METAFIELDS_SET, (data: { metafieldsSet: Payload | null }) => data.metafieldsSet, { metafields });
  return result.ok ? success(undefined) : result;
}

/** Pose le même lien sur le client et, pour une société, sur son entreprise. */
export function setLinks(admin: AdminApiContext, ownerIds: readonly string[], link: AbaNinjaLink): Promise<Done> {
  return setMetafields(admin, ownerIds.map((ownerId) => json(ownerId, LINK_KEY, serializeLink(link))));
}

export function addRefusal(admin: AdminApiContext, client: ShopifyClient, cardUuid: string): Promise<Done> {
  return setMetafields(admin, [json(client.customerId, REFUSED_KEY, serializeUuidList([...client.refused, cardUuid]))]);
}

export function setIgnored(admin: AdminApiContext, shopId: string, uuids: readonly string[]): Promise<Done> {
  return setMetafields(admin, [json(shopId, IGNORED_KEY, serializeUuidList(uuids))]);
}

/** Crée un particulier (lien compris) et renvoie son identifiant. */
export async function createPersonCustomer(admin: AdminApiContext, input: PersonCustomerInput): Promise<Result<string, ShopifyGraphqlError>> {
  const result = await runAdminMutation(
    admin,
    CUSTOMER_CREATE,
    (data: { customerCreate: (Payload & { customer: { id: string } | null }) | null }) => data.customerCreate,
    { input },
  );
  if (!result.ok) return result;
  const customer = result.value.customer;
  return customer === null ? failure(new ShopifyRequestError("Client non créé : Shopify n’a pas renvoyé de fiche")) : success(customer.id);
}

export async function addAddress(admin: AdminApiContext, customerId: string, address: MailingAddress): Promise<Done> {
  const result = await runAdminMutation(admin, ADDRESS_CREATE, (data: { customerAddressCreate: Payload | null }) => data.customerAddressCreate, {
    customerId,
    address,
  });
  return result.ok ? success(undefined) : result;
}

export async function setPhone(admin: AdminApiContext, customerId: string, phone: string): Promise<Done> {
  const result = await runAdminMutation(admin, CUSTOMER_UPDATE, (data: { customerUpdate: Payload | null }) => data.customerUpdate, {
    input: { id: customerId, phone },
  });
  return result.ok ? success(undefined) : result;
}

export async function tagPro(admin: AdminApiContext, customerId: string): Promise<Done> {
  const result = await runAdminMutation(admin, TAGS_ADD, (data: { tagsAdd: Payload | null }) => data.tagsAdd, { id: customerId, tags: ["pro"] });
  return result.ok ? success(undefined) : result;
}
