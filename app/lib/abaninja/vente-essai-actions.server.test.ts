import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";
import { frenchTypography } from "./trial-typography";

/** Bouton « Effacer les factures d'essai » : les pièces d'abord, le client pro fictif en dernier, une seule fois. */

const deps = vi.hoisted(() => ({
  readAbaNinjaConfig: vi.fn(),
  findProClient: vi.fn(),
  eraseTestInvoices: vi.fn(),
  eraseTestSaleNotes: vi.fn(),
  eraseProTestClient: vi.fn(),
  testPiecesRemain: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./config.server", () => ({ readAbaNinjaConfig: deps.readAbaNinjaConfig }));
vi.mock("./vente-client-pro-repository.server", () => ({ findProClient: deps.findProClient }));
vi.mock("./vente-essai-effacer.server", () => ({ eraseTestInvoices: deps.eraseTestInvoices }));
vi.mock("./vente-bon-effacer.server", () => ({ eraseTestSaleNotes: deps.eraseTestSaleNotes }));
vi.mock("./vente-client-pro-effacer.server", () => ({ eraseProTestClient: deps.eraseProTestClient }));
vi.mock("./vente-essai-liste.server", () => ({ testPiecesRemain: deps.testPiecesRemain }));

const { runEraseTestSales } = await import("./vente-essai-actions.server");
const realConfig = await vi.importActual<typeof import("./config.server")>("./config.server");
const READ = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });

const SHOP = "test.myshopify.com";
const NOW = new Date("2026-11-19T15:00:00Z");
const CONFIG = READ.ok ? READ.value : expect.unreachable("configuration d’essai invalide");
const COMPANY = "33333333-3333-4333-8333-333333333333";
const CLIENT = { shop: SHOP, kind: "pro", state: "cree", addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: COMPANY, createdAt: NOW, updatedAt: NOW };

beforeEach(() => {
  vi.clearAllMocks();
  deps.readAbaNinjaConfig.mockReturnValue(READ);
  deps.findProClient.mockResolvedValue(success(CLIENT));
  deps.eraseTestInvoices.mockResolvedValue([{ kind: "effacee", text: "#1036 : facture R02291 effacée." }]);
  deps.eraseTestSaleNotes.mockResolvedValue([{ kind: "effacee", text: "#1038 : bon effacé." }]);
  deps.eraseProTestClient.mockResolvedValue({ kind: "effacee", text: "Client pro fictif effacé." });
  deps.testPiecesRemain.mockResolvedValue(false);
});

describe("effacer les essais", () => {
  it("les pièces laissent le client pro fictif ; il part en dernier, une fois tout le reste effacé", async () => {
    const { result, status } = await runEraseTestSales(SHOP, NOW);
    expect(status).toBe(200);
    expect(deps.eraseTestInvoices).toHaveBeenCalledWith(CONFIG, SHOP, COMPANY, NOW);
    expect(deps.eraseTestSaleNotes).toHaveBeenCalledWith(CONFIG, SHOP, COMPANY, NOW);
    expect(deps.eraseProTestClient).toHaveBeenCalledWith(CONFIG, CLIENT, true, NOW);
    const details = ["#1036 : facture R02291 effacée.", "#1038 : bon effacé.", "Client pro fictif effacé."].map(frenchTypography);
    expect(result).toMatchObject({ tone: "success", details });
  });

  it("une pièce reste à faire à la main : le client pro fictif n'est pas effacé cette fois", async () => {
    deps.eraseTestSaleNotes.mockResolvedValue([{ kind: "a_la_main", text: "#1038 : annulez la facture." }]);
    await runEraseTestSales(SHOP, NOW);
    expect(deps.eraseProTestClient).toHaveBeenCalledWith(CONFIG, CLIENT, false, NOW);
  });

  it("un essai reste noté par l'app (arrivé pendant l'effacement, ou au-delà des 50 lus) : le client n'est pas effacé", async () => {
    deps.testPiecesRemain.mockResolvedValue(true);
    await runEraseTestSales(SHOP, NOW);
    expect(deps.testPiecesRemain).toHaveBeenCalledWith(SHOP);
    expect(deps.eraseProTestClient).toHaveBeenCalledWith(CONFIG, CLIENT, false, NOW);
  });

  it("pas de client pro fictif : les pièces s'effacent comme avant", async () => {
    deps.findProClient.mockResolvedValue(success(null));
    deps.eraseProTestClient.mockResolvedValue(null);
    const { result } = await runEraseTestSales(SHOP, NOW);
    expect(deps.eraseTestSaleNotes).toHaveBeenCalledWith(CONFIG, SHOP, null, NOW);
    expect(result.details).toEqual(["#1036 : facture R02291 effacée.", "#1038 : bon effacé."].map(frenchTypography));
  });

  it("le client pro fictif ne se lit pas : rien n'est effacé, pour ne jamais l'effacer avec une seule pièce", async () => {
    deps.findProClient.mockResolvedValue(failure(new Error("base injoignable")));
    const { result, status } = await runEraseTestSales(SHOP, NOW);
    expect(status).toBe(503);
    expect(result).toMatchObject({ tone: "critical", heading: expect.stringContaining("Réessayez") });
    expect(deps.eraseTestInvoices).not.toHaveBeenCalled();
    expect(deps.eraseTestSaleNotes).not.toHaveBeenCalled();
  });
});
