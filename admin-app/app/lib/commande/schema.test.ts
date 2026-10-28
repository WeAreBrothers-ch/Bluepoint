import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { CUSTOMER, VARIANT_A } from "./fixtures";
import { parsePhoneOrder, parsePriceCalculation } from "./schema";

const TODAY = "2026-10-21" as IsoDate;

function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    intent: "creer",
    idempotencyKey: "4f1c1d7e-3a51-4f0e-9a51-2b9d3c6b8a10",
    customerId: CUSTOMER,
    b2b: null,
    lines: [{ variantId: VARIANT_A, quantity: 12 }],
    requestedDate: "2026-10-22",
    deadline: "2026-10-22",
    mode: "livraison",
    note: "  Livrer avant 11 h  ",
    payment: "bon_de_commande",
    ...overrides,
  };
}

describe("parsePhoneOrder", () => {
  it("accepte une commande complète et nettoie la note", () => {
    const result = parsePhoneOrder(raw(), TODAY);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.note).toBe("Livrer avant 11 h");
  });

  it("exige un client et au moins une bouteille", () => {
    const result = parsePhoneOrder(raw({ customerId: "", lines: [] }), TODAY);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.customerId).toBe("Choisissez un client.");
    expect(!result.ok && result.errors.lines).toBe("Ajoutez au moins une bouteille.");
  });

  it("refuse une date limite avant la date souhaitée", () => {
    const result = parsePhoneOrder(raw({ deadline: "2026-10-21", requestedDate: "2026-10-22" }), TODAY);
    expect(!result.ok && result.errors.deadline).toBe("La date limite ne peut pas précéder la date souhaitée.");
  });

  it("refuse une date passée ou impossible", () => {
    expect(parsePhoneOrder(raw({ requestedDate: "2026-10-20", deadline: "2026-10-20" }), TODAY).ok).toBe(false);
    const impossible = parsePhoneOrder(raw({ requestedDate: "2026-02-30" }), TODAY);
    expect(!impossible.ok && impossible.errors.requestedDate).toBe("Indiquez la date de livraison souhaitée.");
  });

  it("refuse une quantité non entière, un doublon ou un mode inconnu", () => {
    expect(parsePhoneOrder(raw({ lines: [{ variantId: VARIANT_A, quantity: 1.5 }] }), TODAY).ok).toBe(false);
    const doubled = [{ variantId: VARIANT_A, quantity: 1 }, { variantId: VARIANT_A, quantity: 2 }];
    expect(parsePhoneOrder(raw({ lines: doubled }), TODAY).ok).toBe(false);
    const mode = parsePhoneOrder(raw({ mode: "drone" }), TODAY);
    expect(!mode.ok && mode.errors.mode).toBe("Choisissez un mode de livraison.");
  });

  it("refuse une clé d'idempotence qui n'est pas un UUID", () => {
    expect(parsePhoneOrder(raw({ idempotencyKey: "1" }), TODAY).ok).toBe(false);
  });

  it("valide les trois identifiants B2B", () => {
    const b2b = {
      companyId: "gid://shopify/Company/1",
      companyContactId: "gid://shopify/CompanyContact/2",
      companyLocationId: "gid://shopify/CompanyLocation/3",
    };
    expect(parsePhoneOrder(raw({ b2b }), TODAY).ok).toBe(true);
    expect(parsePhoneOrder(raw({ b2b: { ...b2b, companyLocationId: "gid://shopify/Company/3" } }), TODAY).ok).toBe(false);
  });
});

describe("parsePriceCalculation", () => {
  it("exige une entreprise B2B", () => {
    expect(parsePriceCalculation({ customerId: CUSTOMER, b2b: null, lines: [{ variantId: VARIANT_A, quantity: 1 }] })).toBeNull();
  });
});
