import { describe, expect, it } from "vitest";
import { planDeliveryNoteTrial } from "./bl-essai-plan";
import type { TrialOrder, TrialOrderLine } from "./bl-essai-order";

const NOW = new Date("2026-11-19T10:15:00Z");

function money(amount: string) {
  return { shopMoney: { amount } };
}

function line(title: string, quantity: number, unit: string, total: string): TrialOrderLine {
  return {
    title,
    variantTitle: null,
    quantity,
    currentQuantity: quantity,
    originalUnitPriceSet: money(unit),
    discountedTotalSet: money(total),
    taxLines: [{ rate: 0.081 }],
  };
}

const TRATTORIA: TrialOrder = {
  id: "gid://shopify/Order/1028",
  name: "#1028",
  tags: ["fictif"],
  taxesIncluded: true,
  customer: { displayName: "Luca Bianchi" },
  billingAddress: { company: "Trattoria Bellavista (fictif)" },
  dateSouhaitee: { value: "2026-11-26" },
  currentShippingPriceSet: money("0.0"),
  currentTotalDiscountsSet: money("0.0"),
  currentTotalPriceSet: money("738.0"),
  lineItems: {
    nodes: [
      line("Ripasso Valpolicella Superiore 2022 — Corte Moschina", 12, "35.0", "420.0"),
      line("Amarone della Valpolicella DOCG — Corte Moschina", 6, "35.0", "210.0"),
      line("Falanghina IGP 2024 — Tenuta Scuotto", 6, "18.0", "108.0"),
    ],
  },
};

function plan(order: TrialOrder = TRATTORIA) {
  return planDeliveryNoteTrial(order, NOW);
}

describe("essai bon de livraison : préparation depuis une commande fictive", () => {
  it("reprend les vins, les quantités, les prix TTC et la TVA de la commande", () => {
    const result = plan();
    if (!result.ok) throw result.error;
    expect(result.value.note.positions).toEqual([
      { positionNumber: 1, description: "Ripasso Valpolicella Superiore 2022 — Corte Moschina", quantity: 12, unitPrice: 35, vatPercentage: 8.1 },
      { positionNumber: 2, description: "Amarone della Valpolicella DOCG — Corte Moschina", quantity: 6, unitPrice: 35, vatPercentage: 8.1 },
      { positionNumber: 3, description: "Falanghina IGP 2024 — Tenuta Scuotto", quantity: 6, unitPrice: 18, vatPercentage: 8.1 },
    ]);
    expect(result.value.note.pricesIncludeVat).toBe(true);
    expect(result.value.totalChf).toBe(738);
  });

  it("date le bon d'aujourd'hui et la livraison du jour souhaité", () => {
    const result = plan();
    expect(result.ok && result.value.note.deliveryNoteDate).toBe("2026-11-19");
    expect(result.ok && result.value.note.deliveryDate).toBe("2026-11-26");
  });

  it("livre aujourd'hui quand le jour souhaité est passé ou absent", () => {
    const past = plan({ ...TRATTORIA, dateSouhaitee: { value: "2026-11-02" } });
    const none = plan({ ...TRATTORIA, dateSouhaitee: null });
    expect(past.ok && past.value.note.deliveryDate).toBe("2026-11-19");
    expect(none.ok && none.value.note.deliveryDate).toBe("2026-11-19");
  });

  it("donne une référence et un nom de client d'essai reconnaissables", () => {
    const result = plan();
    if (!result.ok) throw result.error;
    expect(result.value.reference).toBe("BP-ESSAI-BL-1028-20261119-101500");
    expect(result.value.note.reference).toBe(result.value.reference);
    expect(result.value.clientName).toBe("Trattoria Bellavista (fictif) · essai BluePoint 20261119-101500 (à supprimer)");
    expect(result.value.address).toMatchObject({ kind: "company", name: result.value.clientName, email: "essai-bl-20261119-101500@example.com" });
  });

  it("refuse une commande qui n'est pas étiquetée « fictif »", () => {
    const result = plan({ ...TRATTORIA, tags: ["pro"] });
    expect(result.ok).toBe(false);
  });

  it("refuse une commande avec rabais ou frais de livraison (pas encore repris par l'essai)", () => {
    expect(plan({ ...TRATTORIA, currentShippingPriceSet: money("15.0") }).ok).toBe(false);
    expect(plan({ ...TRATTORIA, currentTotalDiscountsSet: money("10.0") }).ok).toBe(false);
  });

  it("ignore les vins retirés de la commande et suit les quantités modifiées", () => {
    const [first, second, third] = TRATTORIA.lineItems.nodes;
    if (first === undefined || second === undefined || third === undefined) throw new Error("fixture");
    const edited: TrialOrder = {
      ...TRATTORIA,
      currentTotalPriceSet: money("420.0"),
      lineItems: { nodes: [{ ...first, currentQuantity: 6 }, second, { ...third, currentQuantity: 0 }] },
    };
    const result = plan(edited);
    expect(result.ok && result.value.note.positions.map((p) => [p.description, p.quantity])).toEqual([
      ["Ripasso Valpolicella Superiore 2022 — Corte Moschina", 6],
      ["Amarone della Valpolicella DOCG — Corte Moschina", 6],
    ]);
  });
});
