import { describe, expect, it } from "vitest";
import { d, orderNode } from "../agenda/fixtures";
import { toOrderDetail, type OrderDetailNode } from "./detail";

const today = d("2026-10-28");
const money = (amount: string) => ({ shopMoney: { amount } });

function detailNode(overrides: Partial<OrderDetailNode> = {}): OrderDetailNode {
  return {
    ...orderNode({
      dateSouhaitee: { value: "2026-10-29" },
      currentTotalPriceSet: { shopMoney: { amount: "550.80", currencyCode: "CHF" } },
    }),
    createdAt: "2026-10-27T09:30:00Z",
    email: "marc@exemple.ch",
    currentTotalDiscountsSet: money("97.20"),
    currentShippingPriceSet: money("0.0"),
    currentTotalTaxSet: money("41.27"),
    discountApplications: { nodes: [{ __typename: "AutomaticDiscountApplication", title: "Prix pro -15 %" }] },
    detailLines: {
      nodes: [
        { id: "gid://shopify/LineItem/1", name: "Passione di Re", currentQuantity: 12, variant: { id: "gid://shopify/ProductVariant/11" }, originalUnitPriceSet: money("45.0"), discountedTotalSet: money("540.0") },
        { id: "gid://shopify/LineItem/2", name: "Col del Forno", currentQuantity: 6, variant: { id: "gid://shopify/ProductVariant/12" }, originalUnitPriceSet: money("18.0"), discountedTotalSet: money("108.0") },
        { id: "gid://shopify/LineItem/3", name: "Vin retiré", currentQuantity: 0, variant: null, originalUnitPriceSet: money("10.0"), discountedTotalSet: money("0.0") },
      ],
    },
    ...overrides,
  };
}

describe("fiche commande", () => {
  it("donne le jour, les vins, la remise et le total", () => {
    const detail = toOrderDetail(detailNode(), null, today);
    expect(detail).toMatchObject({
      headline: "À livrer demain (jeudi 29 octobre)",
      late: false,
      orderedLabel: "Commandée le mardi 27 octobre",
      email: "marc@exemple.ch",
      winesCents: 64800,
      discountCents: 9720,
      discountLabel: "Prix pro -15 %",
      shippingCents: 0,
      taxCents: 4127,
      totalCents: 55080,
    });
    expect(detail?.lines.map((line) => [line.quantity, line.name, line.unitCents])).toEqual([
      [12, "Passione di Re", 4500],
      [6, "Col del Forno", 1800],
    ]);
  });

  it("parle comme l'agenda : retrait, Poste, livrée", () => {
    const pickup = toOrderDetail(detailNode({ mode: { value: "retrait" }, dateSouhaitee: { value: "2026-10-28" } }), null, today);
    expect(pickup?.headline).toBe("À préparer pour le retrait aujourd’hui");
    const delivered = toOrderDetail(
      detailNode({
        displayFulfillmentStatus: "FULFILLED",
        fulfillments: [{ status: "SUCCESS", displayStatus: "DELIVERED", createdAt: "2026-10-28T10:00:00Z" }],
      }),
      null,
      today,
    );
    expect(delivered?.headline).toBe("Livrée le mercredi 28 octobre");
  });

  it("ignore une commande annulée", () => {
    expect(toOrderDetail(detailNode({ cancelledAt: "2026-10-28T08:00:00Z" }), null, today)).toBeNull();
  });
});
