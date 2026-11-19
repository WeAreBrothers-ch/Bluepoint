import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";

/** La liste des essais de la page Connexion AbaNinja montre aussi le client pro fictif : il reste effaçable même seul. */

const deps = vi.hoisted(() => ({ findMany: vi.fn(), listTestSales: vi.fn(), findProClient: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: { abaNinjaInvoice: { findMany: deps.findMany } } }));
vi.mock("./vente-repository.server", () => ({ listTestSales: deps.listTestSales }));
vi.mock("./vente-client-pro-repository.server", () => ({ findProClient: deps.findProClient }));

const { loadTestSales, testPiecesRemain } = await import("./vente-essai-liste.server");

const SHOP = "test.myshopify.com";
const NOW = new Date("2026-11-19T15:00:00Z");

function client(state: string) {
  const companyUuid = state === "cree" ? "33333333-3333-4333-8333-333333333333" : null;
  return { shop: SHOP, kind: "pro", state, addressUuid: companyUuid, companyUuid, createdAt: NOW, updatedAt: NOW };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.findMany.mockResolvedValue([]);
  deps.listTestSales.mockResolvedValue(success([]));
  deps.findProClient.mockResolvedValue(success(null));
});

describe("liste des essais", () => {
  it("aucun essai et pas de client pro fictif : liste vide", async () => {
    expect(await loadTestSales(SHOP)).toEqual({ available: true, items: [] });
  });

  it("le client pro fictif resté seul apparaît : le bouton d'effacement reste là", async () => {
    deps.findProClient.mockResolvedValue(success(client("cree")));
    expect(await loadTestSales(SHOP)).toEqual({
      available: true,
      items: [{ orderName: "Client pro fictif", label: "dans AbaNinja, repris par chaque essai d’un pro" }],
    });
  });

  it("client pro fictif en cours de création ou « à vérifier » : dit tel quel", async () => {
    deps.findProClient.mockResolvedValue(success(client("en_cours")));
    expect((await loadTestSales(SHOP)).items).toEqual([{ orderName: "Client pro fictif", label: "en cours de création" }]);
    deps.findProClient.mockResolvedValue(success(client("incertain")));
    expect((await loadTestSales(SHOP)).items).toEqual([{ orderName: "Client pro fictif", label: "à vérifier dans AbaNinja" }]);
  });

  it("reste-t-il un essai ? Oui dès qu'une ligne reste, et dans le doute (base muette)", async () => {
    expect(await testPiecesRemain(SHOP)).toBe(false);
    deps.listTestSales.mockResolvedValue(success([{ orderName: "#1038" }]));
    expect(await testPiecesRemain(SHOP)).toBe(true);
    deps.listTestSales.mockResolvedValue(success([]));
    deps.findMany.mockResolvedValue([{ orderName: "#1036" }]);
    expect(await testPiecesRemain(SHOP)).toBe(true);
    deps.findMany.mockRejectedValue(new Error("base injoignable"));
    expect(await testPiecesRemain(SHOP)).toBe(true);
  });

  it("client pro fictif illisible : la liste n'est pas montrée comme complète", async () => {
    deps.findProClient.mockResolvedValue(failure(new Error("base injoignable")));
    expect(await loadTestSales(SHOP)).toEqual({ available: false, items: [] });
  });
});
