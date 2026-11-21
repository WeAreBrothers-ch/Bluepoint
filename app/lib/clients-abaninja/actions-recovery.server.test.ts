import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, resetFake } from "./actions-fakes";
import { card, client, side, UUID_FAVRE, UUID_LAC } from "./test-builders";

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

describe("relier : reprise après un échec", () => {
  it("termine un compte pro inachevé au lieu de dire « déjà fait »", async () => {
    fake.cards = [card()];
    const linked = { uuid: UUID_LAC, kind: "company" as const, number: "A0153" };
    fake.shopify = side([
      client({ email: "info@lac.ch", companyLink: linked, companyIds: ["gid://shopify/Company/5"], linkedCompanyId: "gid://shopify/Company/5", isPro: true }),
    ]);
    const result = await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("terminé");
    expect(fake.writes).toEqual([{ name: "makePro", args: [expect.anything(), { invite: false, newCustomerOnly: undefined, existingCompanyId: "gid://shopify/Company/5" }] }]);
  });

  it("reprend l'entreprise déjà créée pour cette fiche au lieu d'en créer une seconde", async () => {
    fake.cards = [card()];
    const link = { uuid: UUID_LAC, kind: "company" as const, number: "A0153" };
    fake.shopify = side([client({ email: "info@lac.ch" })], [], [{ companyId: "gid://shopify/Company/8", link }]);
    await act({ intent: "relier", fiche: UUID_LAC, client: "gid://shopify/Customer/1" });
    expect(fake.writes[0]).toMatchObject({ name: "makePro", args: [expect.anything(), { existingCompanyId: "gid://shopify/Company/8" }] });
  });

  it("dit quand l'adresse d'AbaNinja n'a pas pu être ajoutée", async () => {
    fake.cards = [card({ uuid: UUID_FAVRE, kind: "person", name: "Luc Favre", emails: ["luc@favre.ch"] })];
    fake.shopify = side([client({ email: "luc@favre.ch", hasAddress: false, phone: "+41790000000" })]);
    fake.failAddress = true;
    const result = await act({ intent: "relier", fiche: UUID_FAVRE, client: "gid://shopify/Customer/1" });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("adresse d’AbaNinja n’a pas pu être ajoutée");
  });
});

describe("créer : conditions de paiement", () => {
  it("prévient quand aucun paiement sur facture n'est trouvé dans Shopify", async () => {
    fake.cards = [card()];
    fake.paymentTemplate = null;
    const result = await act({ intent: "creer", fiche: UUID_LAC });
    expect(result.message).not.toContain("avec paiement sur facture");
    expect(result.message).toContain("pas de paiement sur facture");
  });
});
