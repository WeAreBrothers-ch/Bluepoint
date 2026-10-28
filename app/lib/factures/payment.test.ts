import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { isPaymentMethod, paymentMethodTag, paymentSituation } from "./payment";

const today = "2026-10-28" as IsoDate;
const invoice = { paidOn: null, dueDate: "2026-10-20" };

describe("situation de paiement d'une facture", () => {
  it("un reçu pro est toujours payé", () => {
    expect(paymentSituation({ paidOn: "2026-10-01", dueDate: "2026-10-01" }, "PENDING", today)).toEqual({
      state: "payee",
      overdueDays: 0,
    });
  });

  it("suit le statut de la commande Shopify", () => {
    expect(paymentSituation(invoice, "PAID", today).state).toBe("payee");
    expect(paymentSituation(invoice, "REFUNDED", today).state).toBe("payee");
  });

  it("compte les jours de retard après l'échéance", () => {
    expect(paymentSituation(invoice, "PENDING", today)).toEqual({ state: "en_retard", overdueDays: 8 });
    expect(paymentSituation({ paidOn: null, dueDate: "2026-10-28" }, "PENDING", today)).toEqual({ state: "a_payer", overdueDays: 0 });
    expect(paymentSituation({ paidOn: null, dueDate: "2026-11-27" }, "PARTIALLY_PAID", today).state).toBe("a_payer");
  });

  it("ne cache jamais une dette quand le statut est inconnu", () => {
    expect(paymentSituation(invoice, null, today).state).toBe("en_retard");
    expect(paymentSituation({ paidOn: null, dueDate: "illisible" }, null, today).state).toBe("a_payer");
  });
});

describe("moyen de paiement", () => {
  it("accepte seulement virement, cash et TWINT", () => {
    expect(isPaymentMethod("twint")).toBe(true);
    expect(isPaymentMethod("cheque")).toBe(false);
    expect(isPaymentMethod(undefined)).toBe(false);
    expect(paymentMethodTag("cash")).toBe("paiement-cash");
  });
});
