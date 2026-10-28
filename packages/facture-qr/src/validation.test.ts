import { describe, expect, it } from "vitest";
import { FactureError } from "./erreurs";
import { FACTURE_EXEMPLE } from "./fixtures/facture";
import { QR_IBAN_EXEMPLE } from "./fixtures/vendeur";
import { validateInvoiceInput } from "./validation";

function erreursDe(raw: unknown): readonly string[] {
  try {
    validateInvoiceInput(raw);
  } catch (erreur) {
    if (erreur instanceof FactureError) return erreur.details;
    throw erreur;
  }
  throw new Error("La validation aurait dû échouer.");
}

describe("validateInvoiceInput", () => {
  it("accepte une facture cohérente et normalise IBAN et numéro TVA", () => {
    const facture = validateInvoiceInput({
      ...FACTURE_EXEMPLE,
      seller: { ...FACTURE_EXEMPLE.seller, vatNumber: "che123456788 mwst" },
    });
    expect(facture.seller.iban).toBe("CH9300762011623852957");
    expect(facture.seller.vatNumber).toBe("CHE-123.456.788 TVA");
    expect(facture.buyer.country).toBe("CH");
  });

  it("tolère un écart d'un centime sur le total, pas davantage", () => {
    expect(() => validateInvoiceInput({ ...FACTURE_EXEMPLE, totalCents: 155101 })).not.toThrow();
    expect(erreursDe({ ...FACTURE_EXEMPLE, totalCents: 155102 })).toEqual([
      expect.stringMatching(/^totalCents : Total incohérent : articles − rabais \+ livraison = CHF.1’551\.00/),
    ]);
  });

  it("ajoute la TVA au total quand les prix sont hors taxes", () => {
    const horsTaxes = { ...FACTURE_EXEMPLE, taxesIncluded: false, totalCents: 155100 + 11622 };
    expect(validateInvoiceInput(horsTaxes).totalCents).toBe(166722);
  });

  it("explique chaque champ fautif en français", () => {
    const details = erreursDe({
      ...FACTURE_EXEMPLE,
      issueDate: "2026-02-31",
      seller: { ...FACTURE_EXEMPLE.seller, vatNumber: "CHE-123.456.789", iban: "CH00 1234" },
      lines: [{ description: "", quantity: 0, unitPriceCents: 24.5, totalCents: 100 }],
      vatLines: [],
    });
    expect(details).toEqual(
      expect.arrayContaining([
        "issueDate : Date impossible.",
        expect.stringMatching(/^seller\.vatNumber : Numéro TVA invalide/),
        expect.stringMatching(/^seller\.iban : IBAN suisse/),
        "lines.0.description : Champ obligatoire.",
        "lines.0.quantity : Quantité d'au moins 1.",
        expect.stringMatching(/^lines\.0\.unitPriceCents : Montant attendu en centimes entiers/),
        expect.stringMatching(/^vatLines : Au moins une ligne de TVA/),
      ]),
    );
  });

  it("refuse une ligne dont le total dépasse quantité × prix", () => {
    const lines = [{ description: "Alma", quantity: 2, unitPriceCents: 1000, totalCents: 2500 }];
    expect(erreursDe({ ...FACTURE_EXEMPLE, lines })).toContain(
      "lines.0.totalCents : Le total de la ligne dépasse quantité × prix unitaire.",
    );
  });

  it("refuse une échéance antérieure à la facture et une devise étrangère", () => {
    expect(erreursDe({ ...FACTURE_EXEMPLE, dueDate: "2026-10-01" })).toEqual([
      "dueDate : L'échéance est antérieure à la date de facture.",
    ]);
    expect(erreursDe({ ...FACTURE_EXEMPLE, currency: "EUR" })).toEqual(["currency : Seule la devise CHF est acceptée."]);
  });

  it("vérifie le QR-IBAN et refuse un QR-IBAN placé dans le champ IBAN", () => {
    const avecQr = { ...FACTURE_EXEMPLE, seller: { ...FACTURE_EXEMPLE.seller, qrIban: QR_IBAN_EXEMPLE } };
    expect(validateInvoiceInput(avecQr).seller.qrIban).toBe("CH4431999123000889012");
    const inverse = { ...FACTURE_EXEMPLE, seller: { ...FACTURE_EXEMPLE.seller, iban: QR_IBAN_EXEMPLE } };
    expect(erreursDe(inverse)).toEqual([expect.stringMatching(/QR-IBAN : le mettre dans « qrIban »/)]);
    const fauxQr = { ...FACTURE_EXEMPLE, seller: { ...FACTURE_EXEMPLE.seller, qrIban: "CH9300762011623852957" } };
    expect(erreursDe(fauxQr)).toEqual([expect.stringMatching(/n'est pas un QR-IBAN/)]);
  });

  it("refuse un objet qui n'est pas une facture", () => {
    expect(() => validateInvoiceInput(null)).toThrow(FactureError);
  });
});
