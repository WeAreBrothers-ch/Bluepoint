import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseGid } from "../shopify/ids";

const deps = vi.hoisted(() => ({ waitUntil: vi.fn(), createSaleNoteForOrder: vi.fn(), cancelSaleNote: vi.fn(), logInfo: vi.fn(), logError: vi.fn() }));

vi.mock("@vercel/functions", () => ({ waitUntil: deps.waitUntil }));
vi.mock("./vente-bon.server", () => ({ createSaleNoteForOrder: deps.createSaleNoteForOrder }));
vi.mock("./vente-bon-suivi.server", () => ({ cancelSaleNote: deps.cancelSaleNote }));
vi.mock("../core/logger.server", () => ({ logInfo: deps.logInfo, logError: deps.logError }));

const { scheduleSaleNote, scheduleSaleNoteCancel } = await import("./vente-bon-schedule.server");

const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");

async function scheduled(): Promise<void> {
  const [promise] = deps.waitUntil.mock.calls[0] ?? [];
  expect(promise).toBeInstanceOf(Promise);
  await promise;
}

beforeEach(() => vi.clearAllMocks());

describe("bon de livraison fait après la réponse au webhook", () => {
  it("confie la création à la plateforme et journalise le résultat", async () => {
    deps.createSaleNoteForOrder.mockResolvedValue({ kind: "cree", noteNumber: "L00042" });
    scheduleSaleNote({} as AdminApiContext, "test.myshopify.com", ORDER);
    await scheduled();
    expect(deps.createSaleNoteForOrder).toHaveBeenCalledWith(expect.anything(), "test.myshopify.com", ORDER);
    expect(deps.logInfo).toHaveBeenCalledWith("Bon de livraison AbaNinja à l’arrivée de la commande", { orderId: ORDER, outcome: "cree" });
  });

  it("journalise une exception sans jamais la relancer", async () => {
    deps.createSaleNoteForOrder.mockRejectedValue(new Error("panne"));
    scheduleSaleNote({} as AdminApiContext, "test.myshopify.com", ORDER);
    await expect(scheduled()).resolves.toBeUndefined();
    expect(deps.logError).toHaveBeenCalledWith("Bon de livraison AbaNinja non fait", expect.any(Error), { orderId: ORDER });
  });
});

describe("bon de livraison annulé après la réponse au webhook orders/cancelled", () => {
  it("annule le bon et journalise le résultat", async () => {
    deps.cancelSaleNote.mockResolvedValue({ kind: "fait" });
    scheduleSaleNoteCancel("test.myshopify.com", ORDER);
    await scheduled();
    expect(deps.cancelSaleNote).toHaveBeenCalledWith("test.myshopify.com", ORDER);
    expect(deps.logInfo).toHaveBeenCalledWith("Bon de livraison AbaNinja à l’annulation de la commande", { orderId: ORDER, outcome: "fait" });
  });

  it("journalise un échec ou une exception, sans jamais relancer", async () => {
    deps.cancelSaleNote.mockRejectedValue(new Error("panne"));
    scheduleSaleNoteCancel("test.myshopify.com", ORDER);
    await expect(scheduled()).resolves.toBeUndefined();
    expect(deps.logError).toHaveBeenCalledWith("Bon de livraison AbaNinja non annulé", expect.any(Error), { orderId: ORDER });
  });
});
