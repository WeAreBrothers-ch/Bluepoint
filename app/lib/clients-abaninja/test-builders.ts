import type { AbaNinjaCard } from "./cards";
import type { ShopifyClient, ShopifySide } from "./shopify-client";

/** Fiches et clients d'exemple pour les tests de la page « Clients AbaNinja ». */

export const UUID_LAC = "11111111-1111-4111-8111-111111111111";
export const UUID_PARC = "22222222-2222-4222-8222-222222222222";
export const UUID_FAVRE = "33333333-3333-4333-8333-333333333333";

export function card(overrides: Partial<AbaNinjaCard> = {}): AbaNinjaCard {
  return {
    uuid: UUID_LAC,
    kind: "company",
    number: "A0153",
    name: "Restaurant du Lac Sàrl",
    firstName: "Marie",
    lastName: "Rochat",
    emails: ["info@lac.ch"],
    phone: "+41211234567",
    address: { street: "Quai du Lac 4", extra: null, zip: "1095", city: "Lutry", countryCode: "CH" },
    vatNumber: null,
    language: "fr",
    tags: [],
    ...overrides,
  };
}

export function client(overrides: Partial<ShopifyClient> = {}): ShopifyClient {
  return {
    customerId: "gid://shopify/Customer/1",
    displayName: "Paul Martin",
    names: ["Paul Martin", "Martin Paul"],
    email: "paul@exemple.ch",
    phone: null,
    town: "1003 Lausanne",
    hasAddress: true,
    isPro: false,
    companyIds: [],
    link: null,
    companyLink: null,
    refused: [],
    ...overrides,
  };
}

export function side(clients: readonly ShopifyClient[], ignored: readonly string[] = []): ShopifySide {
  return { shopId: "gid://shopify/Shop/1", clients, ignored, truncated: false };
}
