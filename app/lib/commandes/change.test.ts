import { describe, expect, it } from "vitest";
import {
  bottlesAfter,
  calculatedLineId,
  changeRules,
  isEmptyPlan,
  PAID_EDIT_BLOCKED,
  parseWantedQuantities,
  planOrderEdit,
  quantitiesFromLines,
} from "./change";

const PASSIONE = "gid://shopify/ProductVariant/11";
const FORNO = "gid://shopify/ProductVariant/12";
const GIN = "gid://shopify/ProductVariant/13";

const lines = [
  { lineItemId: "gid://shopify/LineItem/1", variantId: PASSIONE, quantity: 6 },
  { lineItemId: "gid://shopify/LineItem/2", variantId: FORNO, quantity: 12 },
  { lineItemId: "gid://shopify/LineItem/3", variantId: null, quantity: 1 },
];

const open = { cancelled: false, financialStatus: "PENDING", fulfillmentStatus: "UNFULFILLED", hasInvoice: false };

describe("ce qu'on peut changer", () => {
  it("modifier et annuler une commande pas encore payée ni livrée", () => {
    expect(changeRules(open)).toEqual({ changeable: true, canEdit: true, editBlocked: null, paid: false });
  });

  it("une commande déjà payée s'annule (avec remboursement) mais ne se modifie pas", () => {
    expect(changeRules({ ...open, financialStatus: "PAID" })).toEqual({
      changeable: true,
      canEdit: false,
      editBlocked: PAID_EDIT_BLOCKED,
      paid: true,
    });
  });

  it("rien une fois livrée, facturée ou annulée", () => {
    expect(changeRules({ ...open, fulfillmentStatus: "FULFILLED" }).changeable).toBe(false);
    expect(changeRules({ ...open, hasInvoice: true }).changeable).toBe(false);
    expect(changeRules({ ...open, cancelled: true })).toMatchObject({ changeable: false, canEdit: false, editBlocked: null });
  });
});

describe("modifier les vins", () => {
  it("part des quantités de la commande", () => {
    expect(quantitiesFromLines(lines)).toEqual({ [PASSIONE]: 6, [FORNO]: 12 });
  });

  it("change une quantité, retire un vin, en ajoute un autre", () => {
    const plan = planOrderEdit(lines, { [PASSIONE]: 8, [GIN]: 2 });
    expect(plan).toEqual({
      set: [
        { lineItemId: "gid://shopify/LineItem/1", quantity: 8 },
        { lineItemId: "gid://shopify/LineItem/2", quantity: 0 },
      ],
      add: [{ variantId: GIN, quantity: 2 }],
    });
    expect(bottlesAfter(lines, plan)).toBe(11);
  });

  it("ne fait rien si rien n'a changé, et voit qu'une commande serait vide", () => {
    expect(isEmptyPlan(planOrderEdit(lines, { [PASSIONE]: 6, [FORNO]: 12 }))).toBe(true);
    const emptied = planOrderEdit(lines.slice(0, 2), {});
    expect(bottlesAfter(lines.slice(0, 2), emptied)).toBe(0);
  });

  it("lit les quantités envoyées par la page, refuse ce qui est abîmé", () => {
    expect(parseWantedQuantities(JSON.stringify({ [PASSIONE]: 3, [GIN]: 0 }))).toEqual({ [PASSIONE]: 3 });
    expect(parseWantedQuantities("pas du json")).toBeNull();
    expect(parseWantedQuantities(JSON.stringify({ "gid://shopify/Product/1": 3 }))).toBeNull();
    expect(parseWantedQuantities(JSON.stringify({ [PASSIONE]: -1 }))).toBeNull();
    expect(parseWantedQuantities(JSON.stringify([1, 2]))).toBeNull();
  });

  it("retrouve la ligne pendant la modification", () => {
    expect(calculatedLineId("gid://shopify/LineItem/33933150683460")).toBe("gid://shopify/CalculatedLineItem/33933150683460");
    expect(calculatedLineId("gid://shopify/Order/1")).toBeNull();
  });
});
