import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { expect } from "vitest";
import { parseGid } from "../shopify/ids";

/** Une commande d'essai #1042 qui arrive, et la ligne de vente réservée pour son bon (tests de la création du bon). */

export const ADMIN = {} as AdminApiContext;
export const SHOP = "test.myshopify.com";
export const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
export const NOW = new Date("2026-11-19T11:05:30Z");
export const NOTE = "66666666-6666-4666-8666-666666666666";
export const RECEIVER = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
export const SALE = { orderId: ORDER, reference: "BP-ESSAI-CMD-1042-20261119-110530", noteState: "en_cours", addressUuid: null, companyUuid: null };

export interface FulfillmentFixture {
  readonly status: string;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
}

/** Coordonnées de la commande telles que Shopify les donne pour la facture. */
export function contact(orderTags: readonly string[], customerTags: readonly string[], fulfillments: readonly FulfillmentFixture[] = []) {
  return {
    tags: orderTags,
    email: "luca.fictif@example.com",
    phone: null,
    customer: { defaultEmailAddress: null, defaultPhoneNumber: null, tags: customerTags },
    dateSouhaitee: { value: "2026-11-25" },
    shippingAddress: null,
    billingAddress: null,
    fulfillments,
    displayFinancialStatus: "PENDING",
    transactions: [],
  };
}
