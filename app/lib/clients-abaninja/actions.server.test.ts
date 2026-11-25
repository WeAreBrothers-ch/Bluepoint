import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, resetFake, writtenNames as names } from "./actions-fakes";
import { card, client, side, UUID_FAVRE, UUID_LAC, UUID_PARC } from "./test-builders";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./comparison.server", async () => (await import("./actions-fakes")).comparisonModule);
vi.mock("../reglages/settings.server", async () => (await import("./actions-fakes")).settingsModule);
vi.mock("../commande/reads.server", async () => (await import("./actions-fakes")).readsModule);
vi.mock("../pros/shopify.server", async () => (await import("./actions-fakes")).prosModule);
vi.mock("./shopify-write.server", async () => (await import("./actions-fakes")).writeModule);

const { handleAbaNinjaClientsAction } = await import("./actions.server");
const { findPaymentTemplate } = await import("../commande/reads.server");
const admin = {} as Parameters<typeof handleAbaNinjaClientsAction>[0];

function act(values: Record<string, string>) {
  return handleAbaNinjaClientsAction(admin, "boutique.myshopify.com", new URLSearchParams(values));
}

beforeEach(() => {
  resetFake();
  vi.mocked(findPaymentTemplate).mockClear();
});

describe("relier", () => {
  it("ne réécrit rien quand la fiche est déjà reliée", async () => {
    fake.cards = [card()];
    fake.shopify = side([client({ link: { uuid: UUID_LAC, kind: "company", number: "A0153" }, proReady: true })]);
    const result = await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(result).toMatchObject({ ok: true });
    expect(result.message).toContain("déjà");
    expect(fake.writes).toEqual([]);
  });

  it("refuse un client qui ne correspond pas à la fiche", async () => {
    fake.cards = [card()];
    fake.shopify = side([client({ email: "info@lac.ch" }), client({ customerId: "gid://shopify/Customer/2" })]);
    const result = await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/2" });
    expect(result.ok).toBe(false);
    expect(fake.writes).toEqual([]);
  });

  it("relie une personne et complète l'adresse qui manque", async () => {
    fake.cards = [card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: ["luc@favre.ch"] })];
    fake.shopify = side([client({ email: "luc@favre.ch", hasAddress: false, phone: "+41790000000" })]);
    const result = await act({ intent: "relier", fiche: UUID_FAVRE, client: "gid://shopify/Customer/1" });
    expect(result.ok).toBe(true);
    expect(names()).toEqual(["setLinks", "addAddress"]);
    expect(fake.writes[0]?.args[0]).toEqual(["gid://shopify/Customer/1"]);
  });

  it("relie une société à l'entreprise existante du client et le marque pro", async () => {
    fake.cards = [card()];
    fake.shopify = side([client({ email: "info@lac.ch", companyIds: ["gid://shopify/Company/5"] })]);
    await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(names()).toEqual(["setLinks", "tagPro"]);
    expect(fake.writes[0]?.args[0]).toEqual(["gid://shopify/Customer/1", "gid://shopify/Company/5"]);
  });
});

describe("créer", () => {
  it("crée une société en client pro, sans invitation, et pose le lien sur l'entreprise et le client", async () => {
    fake.cards = [card()];
    const result = await act({ intent: "creer", fiche: UUID_LAC });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Aucun e-mail");
    expect(names()).toEqual(["makePro", "setLinks", "setLinks"]);
    expect(fake.writes[0]?.args[1]).toMatchObject({ invite: false, newCustomerOnly: true, existingCompanyId: null });
    expect(fake.writes[2]?.args[0]).toEqual(["gid://shopify/Customer/90", "gid://shopify/Company/9"]);
  });

  it("ne crée pas une seconde entreprise pour une fiche qu'une entreprise porte déjà", async () => {
    fake.cards = [card()];
    fake.shopify = side([], [], [{ companyId: "gid://shopify/Company/8", link: { uuid: UUID_LAC, kind: "company", number: "A0153" } }]);
    const result = await act({ intent: "creer", fiche: UUID_LAC });
    expect(result.ok).toBe(false);
    expect(fake.writes).toEqual([]);
  });

  it("refuse de créer une fiche sans e-mail", async () => {
    fake.cards = [card({ emails: [] })];
    const result = await act({ intent: "creer", fiche: UUID_LAC });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("pas d’e-mail");
    expect(fake.writes).toEqual([]);
  });
});

describe("lots", () => {
  it("lit les conditions de paiement une seule fois par toucher", async () => {
    fake.cards = [card(), card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["parc@hotel.ch"], phone: null })];
    await act({ intent: "creer_tous" });
    expect(fake.writes.filter((write) => write.name === "makePro")).toHaveLength(2);
    expect(vi.mocked(findPaymentTemplate)).toHaveBeenCalledTimes(1);
  });

  it("garde les réussites et dit combien ont échoué", async () => {
    fake.cards = ["a@x.ch", "b@x.ch", "c@x.ch"].map((email, index) =>
      card({ uuid: [UUID_LAC, UUID_PARC, UUID_FAVRE][index], name: `Société ${index}`, emails: [email], phone: null, address: null }),
    );
    fake.failCreateFor = "b@x.ch";
    const result = await act({ intent: "creer_tous" });
    expect(fake.writes.filter((write) => write.name === "makePro")).toHaveLength(3);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("2 fiches créées");
    expect(result.message).toContain("1 n’a pas marché");
  });

  it("ne crée que les sociétés, en clients pro : les personnes restent à créer une par une", async () => {
    fake.cards = [card(), card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: ["luc@favre.ch"], phone: null })];
    const result = await act({ intent: "creer_tous" });
    expect(result.message).toContain("1 fiche créée");
    expect(names()).not.toContain("createPersonCustomer");
    expect(fake.writes.filter((write) => write.name === "makePro")).toHaveLength(1);
  });
});

describe("refuser, ignorer, remettre", () => {
  it("note qu'un client n'est pas la fiche", async () => {
    fake.cards = [card()];
    fake.shopify = side([client({ names: ["Restaurant du Lac"] })]);
    await act({ intent: "pas_lui", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(fake.writes).toEqual([{ name: "addRefusal", args: [expect.objectContaining({ customerId: "gid://shopify/Customer/1" }), UUID_LAC] }]);
  });

  it("laisse de côté la fiche des ventes aux particuliers", async () => {
    fake.cards = [card({ number: "1062", name: "Clients privés" })];
    const result = await act({ intent: "remettre", fiche: UUID_LAC });
    expect(result.ok).toBe(false);
    expect(fake.writes).toEqual([]);
  });

  it("met une fiche de côté puis la remet", async () => {
    fake.cards = [card()];
    await act({ intent: "ignorer", fiche: UUID_LAC });
    fake.shopify = side([], [UUID_LAC, UUID_PARC]);
    await act({ intent: "remettre", fiche: UUID_LAC });
    expect(fake.writes).toEqual([
      { name: "setIgnored", args: ["gid://shopify/Shop/1", [UUID_LAC]] },
      { name: "setIgnored", args: ["gid://shopify/Shop/1", [UUID_PARC]] },
    ]);
  });
});
