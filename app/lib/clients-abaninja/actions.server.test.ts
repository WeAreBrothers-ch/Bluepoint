import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { ShopifyUserErrors } from "../shopify/errors";
import { compareCards } from "./match";
import { card, client, side, UUID_FAVRE, UUID_LAC, UUID_PARC } from "./test-builders";
import type { ShopifySide } from "./shopify-client";
import type { AbaNinjaCard } from "./cards";

/** Shopify et AbaNinja simulés : chaque écriture est notée, la comparaison est celle que le test prévoit. */

let cards: AbaNinjaCard[] = [];
let shopify: ShopifySide = side([]);
const writes: { readonly name: string; readonly args: readonly unknown[] }[] = [];
let failCreateFor: string | null = null;

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./comparison.server", () => ({
  loadComparison: vi.fn(async () => success({ listing: { cards, skipped: 0, truncated: false }, side: shopify, statuses: compareCards(cards, shopify) })),
}));
vi.mock("../reglages/settings.server", () => ({ loadStoredSettings: vi.fn(async () => null) }));
vi.mock("../commande/reads.server", () => ({
  findPaymentTemplate: vi.fn(async () => ({ template: { id: "gid://shopify/PaymentTermsTemplate/4" } })),
}));
vi.mock("../pros/shopify.server", () => ({
  makePro: vi.fn(async (_admin: unknown, input: { companyName: string }, options: { onCompanyCreated: (id: string) => Promise<void>; invite?: boolean }) => {
    writes.push({ name: "makePro", args: [input, { invite: options.invite }] });
    await options.onCompanyCreated("gid://shopify/Company/9");
    return success({ companyId: "gid://shopify/Company/9", customerId: "gid://shopify/Customer/90", alreadyPro: false, invited: false });
  }),
}));
vi.mock("./shopify-write.server", () => {
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      writes.push({ name, args: args.slice(1) });
      return success(name === "createPersonCustomer" ? "gid://shopify/Customer/77" : undefined);
    };
  return {
    setLinks: record("setLinks"),
    addRefusal: record("addRefusal"),
    setIgnored: record("setIgnored"),
    addAddress: record("addAddress"),
    setPhone: record("setPhone"),
    tagPro: record("tagPro"),
    createPersonCustomer: vi.fn(async (_admin: unknown, input: { email: string }) => {
      if (input.email === failCreateFor) return failure(new ShopifyUserErrors([{ field: null, message: "Email has already been taken" }]));
      writes.push({ name: "createPersonCustomer", args: [input] });
      return success("gid://shopify/Customer/77");
    }),
  };
});

const { handleAbaNinjaClientsAction } = await import("./actions.server");
const admin = {} as Parameters<typeof handleAbaNinjaClientsAction>[0];

function act(values: Record<string, string>) {
  return handleAbaNinjaClientsAction(admin, "boutique.myshopify.com", new URLSearchParams(values));
}

function names(): string[] {
  return writes.map((write) => write.name);
}

beforeEach(() => {
  cards = [];
  shopify = side([]);
  writes.length = 0;
  failCreateFor = null;
});

describe("relier", () => {
  it("ne réécrit rien quand la fiche est déjà reliée", async () => {
    cards = [card()];
    shopify = side([client({ link: { uuid: UUID_LAC, kind: "company", number: "A0153" } })]);
    const result = await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(result).toMatchObject({ ok: true });
    expect(result.message).toContain("déjà");
    expect(writes).toEqual([]);
  });

  it("refuse un client qui ne correspond pas à la fiche", async () => {
    cards = [card()];
    shopify = side([client({ email: "info@lac.ch" }), client({ customerId: "gid://shopify/Customer/2" })]);
    const result = await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/2" });
    expect(result.ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it("relie une personne et complète l'adresse qui manque", async () => {
    cards = [card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: ["luc@favre.ch"] })];
    shopify = side([client({ email: "luc@favre.ch", hasAddress: false, phone: "+41790000000" })]);
    const result = await act({ intent: "relier", fiche: UUID_FAVRE, client: "gid://shopify/Customer/1" });
    expect(result.ok).toBe(true);
    expect(names()).toEqual(["setLinks", "addAddress"]);
    expect(writes[0]?.args[0]).toEqual(["gid://shopify/Customer/1"]);
  });

  it("relie une société à l'entreprise existante du client et le marque pro", async () => {
    cards = [card()];
    shopify = side([client({ email: "info@lac.ch", companyIds: ["gid://shopify/Company/5"] })]);
    await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(names()).toEqual(["setLinks", "tagPro"]);
    expect(writes[0]?.args[0]).toEqual(["gid://shopify/Customer/1", "gid://shopify/Company/5"]);
  });
});

describe("créer", () => {
  it("crée une société en client pro, sans invitation, et pose le lien sur l'entreprise et le client", async () => {
    cards = [card()];
    const result = await act({ intent: "creer", fiche: UUID_LAC });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Aucun e-mail");
    expect(names()).toEqual(["makePro", "setLinks", "setLinks"]);
    expect(writes[0]?.args[1]).toEqual({ invite: false });
    expect(writes[2]?.args[0]).toEqual(["gid://shopify/Customer/90", "gid://shopify/Company/9"]);
  });

  it("refuse de créer une fiche sans e-mail", async () => {
    cards = [card({ emails: [] })];
    const result = await act({ intent: "creer", fiche: UUID_LAC });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("pas d’e-mail");
    expect(writes).toEqual([]);
  });
});

describe("lots", () => {
  it("garde les réussites et dit combien ont échoué", async () => {
    cards = ["a@x.ch", "b@x.ch", "c@x.ch"].map((email, index) =>
      card({ uuid: [UUID_LAC, UUID_PARC, UUID_FAVRE][index], kind: "person", name: `Personne ${index}`, emails: [email], phone: null, address: null }),
    );
    failCreateFor = "b@x.ch";
    const result = await act({ intent: "creer_tous" });
    expect(writes.filter((write) => write.name === "createPersonCustomer")).toHaveLength(2);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("2 fiches créées");
    expect(result.message).toContain("1 n’a pas marché");
  });
});

describe("refuser, ignorer, remettre", () => {
  it("note qu'un client n'est pas la fiche", async () => {
    cards = [card()];
    shopify = side([client({ names: ["Restaurant du Lac"] })]);
    await act({ intent: "pas_lui", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(writes).toEqual([{ name: "addRefusal", args: [expect.objectContaining({ customerId: "gid://shopify/Customer/1" }), UUID_LAC] }]);
  });

  it("met une fiche de côté puis la remet", async () => {
    cards = [card()];
    await act({ intent: "ignorer", fiche: UUID_LAC });
    shopify = side([], [UUID_LAC, UUID_PARC]);
    await act({ intent: "remettre", fiche: UUID_LAC });
    expect(writes).toEqual([
      { name: "setIgnored", args: ["gid://shopify/Shop/1", [UUID_LAC]] },
      { name: "setIgnored", args: ["gid://shopify/Shop/1", [UUID_PARC]] },
    ]);
  });
});
