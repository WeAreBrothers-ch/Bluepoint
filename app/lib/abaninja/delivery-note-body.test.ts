import { describe, expect, it } from "vitest";
import { buildDeliveryNoteBody } from "./delivery-note-body";
import { deliveryNoteInputSchema, type AbaNinjaDeliveryNoteInput } from "./delivery-note-input";

const RECEIVER = { addressUuid: "0b7d8f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", companyUuid: "1c8e9a1f-2d3e-4f50-9b0c-1d2e3f4a5b6c" };

const NOTE: AbaNinjaDeliveryNoteInput = {
  receiver: RECEIVER,
  reference: "BP-ESSAI-BL-1042-20261119-101500",
  title: "Bon de livraison (essai)",
  deliveryNoteDate: "2026-11-19",
  deliveryDate: "2026-11-26",
  pricesIncludeVat: true,
  positions: [
    { positionNumber: 1, description: "Merlot del Ticino Picaia 2022 · 75 cl", quantity: 12, unitPrice: 24, vatPercentage: 8.1 },
    { positionNumber: 2, description: "Alma Bio IGT · 75 cl", quantity: 12, unitPrice: 37.5, vatPercentage: 8.1 },
  ],
};

describe("bon de livraison AbaNinja", () => {
  it("envoie un vrai bon (pas un modèle) avec ses dates, le client et les vins", () => {
    const valid = deliveryNoteInputSchema.parse(NOTE);
    expect(buildDeliveryNoteBody(valid)).toEqual({
      documents: [
        {
          isTemplate: false,
          currencyCode: "CHF",
          reference: NOTE.reference,
          title: NOTE.title,
          deliveryNoteDate: "2026-11-19",
          deliveryDate: "2026-11-26",
          pricesIncludeVat: true,
          receiver: RECEIVER,
          positions: [
            { positionNumber: 1, kind: "product", productDescription: "Merlot del Ticino Picaia 2022 · 75 cl", quantity: 12, singlePrice: 24, vat: { percentage: 8.1 } },
            { positionNumber: 2, kind: "product", productDescription: "Alma Bio IGT · 75 cl", quantity: 12, singlePrice: 37.5, vat: { percentage: 8.1 } },
          ],
        },
      ],
    });
  });

  it("refuse un bon sans vin, avec des lignes mal numérotées ou une livraison avant le bon", () => {
    expect(deliveryNoteInputSchema.safeParse({ ...NOTE, positions: [] }).success).toBe(false);
    expect(deliveryNoteInputSchema.safeParse({ ...NOTE, positions: NOTE.positions.map((p) => ({ ...p, positionNumber: 1 })) }).success).toBe(false);
    expect(deliveryNoteInputSchema.safeParse({ ...NOTE, deliveryDate: "2026-11-18" }).success).toBe(false);
  });
});
