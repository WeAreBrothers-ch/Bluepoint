import { describe, expect, it } from "vitest";
import { parseRetire, retireMessage, retireWarnings } from "./retire";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("retirer un vin de la vente", () => {
  it("lit la demande, et refuse un identifiant douteux", () => {
    expect(parseRetire(form({ intent: "retirer", productId: "gid://shopify/Product/7", title: "Barolo" }))).toEqual({
      ok: true,
      intent: "retirer",
      productId: "gid://shopify/Product/7",
      title: "Barolo",
    });
    expect(parseRetire(form({ intent: "remettre", productId: "gid://shopify/Order/7" })).ok).toBe(false);
    expect(parseRetire(form({ intent: "effacer", productId: "gid://shopify/Product/7" })).ok).toBe(false);
  });

  it("prévient de ce qui reste en cave et des commandes à livrer", () => {
    expect(retireWarnings({ onHand: 0, committed: 0 })).toEqual([]);
    expect(retireWarnings({ onHand: 449, committed: 3 })).toEqual([
      "Il reste 74 cartons et 5 bouteilles en cave : ils ne seront plus proposés à la vente.",
      "3 bouteilles sont réservées pour des commandes pas encore livrées : ces commandes restent à livrer.",
    ]);
  });

  it("dit où retrouver le vin", () => {
    expect(retireMessage("retirer", "Barolo")).toContain("Vins retirés de la vente");
    expect(retireMessage("remettre", "Barolo")).toBe("« Barolo » est de nouveau en vente, sur le site et dans « Prendre une commande ».");
  });
});
