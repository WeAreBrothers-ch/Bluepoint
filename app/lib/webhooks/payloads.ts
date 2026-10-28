import { parseGid, type OrderGid, type ShopifyGid } from "../shopify/ids";

/**
 * Lecture sûre des charges utiles de webhooks : Shopify envoie du JSON non typé,
 * on n'en extrait que les champs utiles, après vérification.
 */

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: JsonObject, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

/** Attribut de panier recopié sur la commande (`note_attributes` : nom + valeur). */
export interface NoteAttribute {
  readonly key: string;
  readonly value: string | null;
}

export interface OrderCreatedPayload {
  readonly orderId: OrderGid;
  readonly name: string;
  readonly noteAttributes: readonly NoteAttribute[];
}

function readNoteAttributes(payload: JsonObject): NoteAttribute[] {
  const raw = payload["note_attributes"];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: unknown) => {
    if (!isObject(item)) return [];
    const key = readString(item, "name");
    const value = item["value"];
    if (key === null) return [];
    return [{ key, value: typeof value === "string" ? value : typeof value === "number" ? String(value) : null }];
  });
}

export function readOrderCreated(payload: unknown): OrderCreatedPayload | null {
  if (!isObject(payload)) return null;
  const gid = readString(payload, "admin_graphql_api_id");
  const name = readString(payload, "name");
  const orderId = gid === null ? null : parseGid(gid, "Order");
  return orderId === null || name === null ? null : { orderId, name, noteAttributes: readNoteAttributes(payload) };
}

/** Commande payée (webhook orders/paid) : seul l'identifiant de la commande est utile. */
export function readOrderPaid(payload: unknown): OrderGid | null {
  if (!isObject(payload)) return null;
  const gid = readString(payload, "admin_graphql_api_id");
  return gid === null ? null : parseGid(gid, "Order");
}

export interface FulfillmentCreatedPayload {
  readonly fulfillmentId: ShopifyGid<"Fulfillment">;
  readonly orderId: OrderGid | null;
}

function readOrderIdFromFulfillment(payload: JsonObject): OrderGid | null {
  const numericId = payload["order_id"];
  return typeof numericId === "number" || typeof numericId === "string"
    ? parseGid(`gid://shopify/Order/${numericId}`, "Order")
    : null;
}

export function readFulfillmentCreated(payload: unknown): FulfillmentCreatedPayload | null {
  if (!isObject(payload)) return null;
  const gid = readString(payload, "admin_graphql_api_id");
  const fulfillmentId = gid === null ? null : parseGid(gid, "Fulfillment");
  return fulfillmentId === null
    ? null
    : { fulfillmentId, orderId: readOrderIdFromFulfillment(payload) };
}

export function readCurrentScopes(payload: unknown): string[] | null {
  if (!isObject(payload) || !Array.isArray(payload["current"])) return null;
  const scopes = payload["current"].filter((scope): scope is string => typeof scope === "string");
  return scopes;
}
