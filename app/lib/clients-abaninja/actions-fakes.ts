import { vi } from "vitest";
import { failure, success } from "../core/result";
import { ShopifyUserErrors } from "../shopify/errors";
import type { AbaNinjaCard } from "./cards";
import { compareCards } from "./match";
import type { ShopifySide } from "./shopify-client";
import { side } from "./test-builders";

/**
 * Shopify et AbaNinja simulés pour les tests des boutons : chaque écriture est notée, la comparaison est celle
 * que le test prévoit. Chaque fichier de test branche ces modules avec `vi.mock(…, () => import("./actions-fakes"))`.
 */

const TEMPLATE = { template: { id: "gid://shopify/PaymentTermsTemplate/4" } };

interface Write {
  readonly name: string;
  readonly args: readonly unknown[];
}

export const fake = {
  cards: [] as AbaNinjaCard[],
  shopify: side([]) as ShopifySide,
  writes: [] as Write[],
  failCreateFor: null as string | null,
  failAddress: false,
  paymentTemplate: TEMPLATE as typeof TEMPLATE | null,
};

export function resetFake(): void {
  fake.cards = [];
  fake.shopify = side([]);
  fake.writes.length = 0;
  fake.failCreateFor = null;
  fake.failAddress = false;
  fake.paymentTemplate = TEMPLATE;
}

export function writtenNames(): string[] {
  return fake.writes.map((write) => write.name);
}

export const comparisonModule = {
  loadComparison: vi.fn(async () =>
    success({ listing: { cards: fake.cards, skipped: 0, truncated: false }, side: fake.shopify, statuses: compareCards(fake.cards, fake.shopify) }),
  ),
};

export const settingsModule = { loadStoredSettings: vi.fn(async () => null) };

export const readsModule = { findPaymentTemplate: vi.fn(async () => fake.paymentTemplate) };

interface MakeProOptionsSeen {
  readonly onCompanyCreated: (id: string) => Promise<void>;
  readonly invite?: boolean;
  readonly newCustomerOnly?: boolean;
  readonly existingCompanyId: string | null;
}

export const prosModule = {
  makePro: vi.fn(async (_admin: unknown, input: { companyName: string; email: string }, options: MakeProOptionsSeen) => {
    const { invite, newCustomerOnly, existingCompanyId } = options;
    fake.writes.push({ name: "makePro", args: [input, { invite, newCustomerOnly, existingCompanyId }] });
    if (input.email === fake.failCreateFor) return failure(new Error("Cet e-mail est déjà celui d’un client de la boutique."));
    if (existingCompanyId === null) await options.onCompanyCreated("gid://shopify/Company/9");
    const companyId = existingCompanyId ?? "gid://shopify/Company/9";
    return success({ companyId, customerId: "gid://shopify/Customer/90", alreadyPro: false, invited: false });
  }),
};

const record =
  (name: string) =>
  async (...args: unknown[]) => {
    fake.writes.push({ name, args: args.slice(1) });
    if (name === "addAddress" && fake.failAddress) return failure(new ShopifyUserErrors([{ field: null, message: "Zip is invalid" }]));
    return success(undefined);
  };

export const writeModule = {
  setLinks: record("setLinks"),
  addRefusal: record("addRefusal"),
  setIgnored: record("setIgnored"),
  addAddress: record("addAddress"),
  setPhone: record("setPhone"),
  tagPro: record("tagPro"),
  createPersonCustomer: vi.fn(async (_admin: unknown, input: { email: string }) => {
    if (input.email === fake.failCreateFor) return failure(new ShopifyUserErrors([{ field: null, message: "Email has already been taken" }]));
    fake.writes.push({ name: "createPersonCustomer", args: [input] });
    return success("gid://shopify/Customer/77");
  }),
};
