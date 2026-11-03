import { describe, expect, it } from "vitest";
import { MESSAGE_MAX_LENGTH, parseEditedEmail } from "./message-input";
import { toMessageLines } from "./order-lines";

describe("objet et message relus", () => {
  it("garde l'objet sur une ligne et nettoie le message", () => {
    expect(parseEditedEmail("  Facture\r\nBP-1  ", "Bonjour,\r\n\r\nMerci  \n")).toEqual({
      ok: true,
      value: { subject: "Facture BP-1", text: "Bonjour,\n\nMerci" },
    });
  });

  it("refuse un objet ou un message vide, trop long ou absent", () => {
    expect(parseEditedEmail(" ", "Bonjour")).toMatchObject({ ok: false, message: "Indiquez un objet pour l’e-mail." });
    expect(parseEditedEmail("Objet", "  ")).toMatchObject({ ok: false, message: "Le message est vide." });
    expect(parseEditedEmail("Objet", "x".repeat(MESSAGE_MAX_LENGTH + 1)).ok).toBe(false);
    expect(parseEditedEmail(null, "Bonjour").ok).toBe(false);
  });
});

describe("récapitulatif depuis Shopify", () => {
  it("retire les lignes supprimées et le titre de déclinaison par défaut", () => {
    expect(
      toMessageLines([
        { title: "Dézaley Marsens", variantTitle: "Default Title", currentQuantity: 12 },
        { title: "Col del Forno", variantTitle: "Magnum", currentQuantity: 6 },
        { title: "Dry Gin", variantTitle: null, currentQuantity: 0 },
      ]),
    ).toEqual([
      { quantity: 12, label: "Dézaley Marsens" },
      { quantity: 6, label: "Col del Forno — Magnum" },
    ]);
  });
});
