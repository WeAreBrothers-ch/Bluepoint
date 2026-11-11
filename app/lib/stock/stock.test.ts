import { describe, expect, it } from "vitest";
import {
  availableText,
  filterStock,
  parseStockChange,
  reservedText,
  sortByUrgency,
  stockChangeMessage,
  stockSummary,
  toStockItem,
  type StockVariantNode,
} from "./stock";

function variant(title: string, quantities: { available: number; onHand: number; committed: number } | null): StockVariantNode {
  return {
    id: `gid://shopify/ProductVariant/${title.length}`,
    title: "Default Title",
    price: "45.00",
    product: { id: "gid://shopify/Product/5", title, hasOnlyDefaultVariant: true, featuredMedia: null },
    inventoryItem:
      quantities === null
        ? { id: "gid://shopify/InventoryItem/9", tracked: false, inventoryLevels: { nodes: [] } }
        : {
            id: "gid://shopify/InventoryItem/7",
            tracked: true,
            inventoryLevels: {
              nodes: [
                {
                  location: { id: "gid://shopify/Location/3" },
                  quantities: [
                    { name: "available", quantity: quantities.available },
                    { name: "on_hand", quantity: quantities.onHand },
                    { name: "committed", quantity: quantities.committed },
                  ],
                },
              ],
            },
          },
  };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const place = { inventoryItemId: "gid://shopify/InventoryItem/7", locationId: "gid://shopify/Location/3", key: "1b9d6bcd-bbfd-4b2d" };

describe("stock des vins", () => {
  it("lit le disponible, la cave et le réservé", () => {
    const item = toStockItem(variant("Passione di Re", { available: 5, onHand: 11, committed: 6 }));
    expect(item).toMatchObject({ label: "Passione di Re", priceCents: 4500, available: 5, onHand: 11, committed: 6, level: "bas" });
    expect(item.place).toEqual({ inventoryItemId: "gid://shopify/InventoryItem/7", locationId: "gid://shopify/Location/3" });
    expect(availableText(item)).toBe("5 bouteilles disponibles");
    expect(reservedText(item)).toBe("11 en cave, dont 6 réservées pour des commandes pas encore livrées");
  });

  it("signale les vins épuisés et bientôt épuisés, ignore ceux qui ne sont pas comptés", () => {
    const items = [
      toStockItem(variant("Brunello", { available: 0, onHand: 3, committed: 3 })),
      toStockItem(variant("Dry Gin", { available: 6, onHand: 6, committed: 0 })),
      toStockItem(variant("Col del Forno", { available: 30, onHand: 30, committed: 0 })),
      toStockItem(variant("Bon cadeau", null)),
    ];
    expect(items.map((item) => item.level)).toEqual(["epuise", "bas", "ok", "non_suivi"]);
    expect(items[3]?.place).toBeNull();
    expect(stockSummary(items)).toEqual({ soldOut: ["Brunello"], low: ["Dry Gin"] });
    expect(availableText(items[0]!)).toBe("Plus aucune bouteille à vendre");
    expect(reservedText(items[2]!)).toBeNull();
  });

  it("cherche sans tenir compte des accents", () => {
    const items = [toStockItem(variant("Dézaley Marsens", null)), toStockItem(variant("Dry Gin", null))];
    expect(filterStock(items, "dezaley").map((item) => item.label)).toEqual(["Dézaley Marsens"]);
    expect(filterStock(items, "  ")).toHaveLength(2);
  });
});

describe("changement de stock", () => {
  it("accepte des bouteilles reçues et un comptage de la cave", () => {
    const added = parseStockChange(form({ intent: "ajouter", ...place, quantity: "12", expected: "5" }));
    expect(added).toEqual({ ok: true, change: { intent: "ajouter", ...place, quantity: 12, expected: 5 } });
    const counted = parseStockChange(form({ intent: "corriger", ...place, quantity: "0", expected: "-2" }));
    expect(counted.ok && counted.change.quantity).toBe(0);
  });

  it("refuse une quantité vide ou une demande abîmée, avec un message simple", () => {
    const empty = parseStockChange(form({ intent: "ajouter", ...place, quantity: "0", expected: "5" }));
    expect(empty).toMatchObject({ ok: false, message: "Indiquez combien de bouteilles arrivent (au moins 1)." });
    const broken = parseStockChange(form({ intent: "ajouter", ...place, locationId: "12", quantity: "3", expected: "5" }));
    expect(broken.ok).toBe(false);
    const noKey = parseStockChange(form({ intent: "corriger", ...place, key: "x", quantity: "3", expected: "5" }));
    expect(noKey.ok).toBe(false);
  });

  it("dit ce qui a changé", () => {
    expect(stockChangeMessage({ intent: "ajouter", quantity: 12 }, 17)).toBe(
      "C’est noté\u202F: 12 bouteilles ajoutées. Il y en a maintenant 17 bouteilles disponibles.",
    );
    expect(stockChangeMessage({ intent: "ajouter", quantity: 1 }, null)).toBe("C’est noté\u202F: 1 bouteille ajoutée.");
    expect(stockChangeMessage({ intent: "corriger", quantity: 24 }, 24)).toBe("C’est noté\u202F: 24 bouteilles en cave.");
  });
});

describe("ordre de la page Stock", () => {
  const item = (title: string, quantities: { available: number; onHand: number; committed: number } | null) =>
    toStockItem(variant(title, quantities));

  it("met les vins à recommander en premier, puis garde l'ordre d'origine", () => {
    const items = [
      item("Gamay", { available: 42, onHand: 42, committed: 0 }),
      item("Pinot", { available: 5, onHand: 12, committed: 7 }),
      item("Chasselas", { available: 96, onHand: 120, committed: 24 }),
      item("Dézaley", { available: 0, onHand: 6, committed: 6 }),
      item("Rosé", null),
    ];
    expect(sortByUrgency(items).map((i) => i.label)).toEqual(["Dézaley", "Pinot", "Gamay", "Chasselas", "Rosé"]);
  });

  it("ne modifie pas la liste d'origine", () => {
    const items = [item("A", { available: 50, onHand: 50, committed: 0 }), item("B", { available: 0, onHand: 0, committed: 0 })];
    sortByUrgency(items);
    expect(items.map((i) => i.label)).toEqual(["A", "B"]);
  });
});

import { confirmationQuestion } from "./stock";

describe("confirmation avant d'enregistrer le stock", () => {
  it("redemande quand le comptage change beaucoup ou tombe à zéro", () => {
    expect(confirmationQuestion("corriger", 48, 0)).toBe("Vous passez de 48 bouteilles à 0 bouteille en cave. C’est bien ça ?");
    expect(confirmationQuestion("corriger", 60, 600)).not.toBeNull();
    expect(confirmationQuestion("corriger", 48, 45)).toBeNull();
    expect(confirmationQuestion("corriger", 48, 48)).toBeNull();
  });

  it("redemande pour un très gros ajout seulement", () => {
    expect(confirmationQuestion("ajouter", 10, 12)).toBeNull();
    expect(confirmationQuestion("ajouter", 10, 600)).toBe("Vous ajoutez 600 bouteilles d’un coup. C’est bien ça ?");
  });
});
