import { isQRReferenceValid, isSCORReferenceValid } from "swissqrbill/utils";
import { describe, expect, it } from "vitest";
import { FactureError } from "./erreurs";
import { referencePaiement, referenceQrr, referenceScor } from "./reference";

describe("référence RF (SCOR)", () => {
  it("est tirée des chiffres du numéro de facture et valide", () => {
    const reference = referenceScor("BP-2026-0042");
    expect(reference).toBe("RF8820260042");
    expect(isSCORReferenceValid(reference)).toBe(true);
  });
});

describe("référence QR (QRR)", () => {
  it("compte 27 chiffres, complétés par des zéros, avec un chiffre de contrôle valide", () => {
    const reference = referenceQrr("BP-2026-0042");
    expect(reference).toHaveLength(27);
    expect(reference.startsWith("00000000000000000020260042")).toBe(true);
    expect(isQRReferenceValid(reference)).toBe(true);
  });

  it("correspond à l'exemple officiel SIX", () => {
    expect(referenceQrr("21000000000313947143000901")).toBe("210000000003139471430009017");
  });

  it("refuse un numéro sans chiffre ou trop long", () => {
    expect(() => referenceQrr("BP-SANS")).toThrow(FactureError);
    expect(() => referenceQrr("0000")).toThrow(FactureError);
    expect(() => referenceQrr("1".repeat(27))).toThrow(FactureError);
    expect(() => referenceScor("1".repeat(22))).toThrow(FactureError);
  });
});

describe("referencePaiement", () => {
  it("choisit QRR avec un QR-IBAN et RF sinon", () => {
    expect(referencePaiement("BP-2026-0042", true).type).toBe("QRR");
    expect(referencePaiement("BP-2026-0042", false).type).toBe("SCOR");
  });
});
