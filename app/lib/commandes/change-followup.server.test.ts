import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { frenchTypography } from "../abaninja/trial-typography";

const deps = vi.hoisted(() => ({ handleOrderChange: vi.fn(), syncSaleNote: vi.fn(), cancelSaleNote: vi.fn() }));

vi.mock("./change.server", () => ({ handleOrderChange: deps.handleOrderChange }));
vi.mock("../abaninja/vente-bon-suivi.server", () => ({ syncSaleNote: deps.syncSaleNote, cancelSaleNote: deps.cancelSaleNote }));

const { handleOrderChangeWithSale } = await import("./change-followup.server");

const ADMIN = {} as AdminApiContext;
const SHOP = "test.myshopify.com";
const ORDER = "gid://shopify/Order/1042";

function form(intent: string): FormData {
  const data = new FormData();
  data.set("intent", intent);
  data.set("orderId", ORDER);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.syncSaleNote.mockResolvedValue({ kind: "fait" });
  deps.cancelSaleNote.mockResolvedValue({ kind: "fait" });
});

describe("« Modifier les vins » et « Annuler » suivis dans AbaNinja", () => {
  it("remet le bon à jour après une modification réussie", async () => {
    deps.handleOrderChange.mockResolvedValue({ ok: true, intent: "modifier", message: "Commande modifiée." });
    const result = await handleOrderChangeWithSale(ADMIN, SHOP, form("modifier"));
    expect(deps.syncSaleNote).toHaveBeenCalledWith(ADMIN, SHOP, ORDER);
    expect(result).toEqual({ ok: true, intent: "modifier", message: "Commande modifiée. Le bon de livraison AbaNinja est à jour." });
  });

  it("garde la commande modifiée et dit pourquoi le bon n'a pas suivi", async () => {
    deps.handleOrderChange.mockResolvedValue({ ok: true, intent: "modifier", message: "Commande modifiée." });
    deps.syncSaleNote.mockResolvedValue({ kind: "echec", message: "AbaNinja est momentanément injoignable." });
    const result = await handleOrderChangeWithSale(ADMIN, SHOP, form("modifier"));
    expect(result).toEqual({
      ok: true,
      intent: "modifier",
      message: `Commande modifiée. ${frenchTypography("Le bon de livraison AbaNinja n’a pas suivi : AbaNinja est momentanément injoignable.")}`,
    });
  });

  it("annule le bon après l'annulation de la commande", async () => {
    deps.handleOrderChange.mockResolvedValue({ ok: true, intent: "annuler", message: "Commande annulée." });
    const result = await handleOrderChangeWithSale(ADMIN, SHOP, form("annuler"));
    expect(deps.cancelSaleNote).toHaveBeenCalledWith(SHOP, ORDER);
    expect(result.message).toBe("Commande annulée. Le bon de livraison AbaNinja est annulé.");
  });

  it("ne dit rien de plus pour une commande sans bon", async () => {
    deps.handleOrderChange.mockResolvedValue({ ok: true, intent: "modifier", message: "Commande modifiée." });
    deps.syncSaleNote.mockResolvedValue({ kind: "rien" });
    expect((await handleOrderChangeWithSale(ADMIN, SHOP, form("modifier"))).message).toBe("Commande modifiée.");
  });

  it("ne touche pas AbaNinja quand Shopify a refusé le changement", async () => {
    deps.handleOrderChange.mockResolvedValue({ ok: false, intent: "modifier", message: "Ça n’a pas marché." });
    expect(await handleOrderChangeWithSale(ADMIN, SHOP, form("modifier"))).toEqual({ ok: false, intent: "modifier", message: "Ça n’a pas marché." });
    expect(deps.syncSaleNote).not.toHaveBeenCalled();
  });

  it("une panne du suivi n'efface jamais la réussite du changement", async () => {
    deps.handleOrderChange.mockResolvedValue({ ok: true, intent: "annuler", message: "Commande annulée." });
    deps.cancelSaleNote.mockRejectedValue(new Error("base injoignable"));
    const result = await handleOrderChangeWithSale(ADMIN, SHOP, form("annuler"));
    expect(result.ok).toBe(true);
    expect(result.message).toContain("Commande annulée.");
  });
});
