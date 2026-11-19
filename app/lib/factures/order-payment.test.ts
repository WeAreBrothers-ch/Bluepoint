import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { invoicePaymentOf, type PaymentTransaction } from "./order-payment";

const TODAY = "2026-11-19" as IsoDate;

function order(displayFinancialStatus: string | null, transactions: readonly PaymentTransaction[] = []) {
  return { displayFinancialStatus, transactions };
}

const capture = (processedAt: string, status = "SUCCESS"): PaymentTransaction => ({ kind: "CAPTURE", status, processedAt });

describe("invoicePaymentOf", () => {
  it("une commande pas encore payée reçoit la QR-facture", () => {
    for (const status of ["PENDING", "EXPIRED", "VOIDED", null]) {
      expect(invoicePaymentOf(order(status), TODAY)).toEqual({ kind: "a_payer" });
    }
  });

  it("une commande déjà payée reçoit une facture acquittée, datée du jour du paiement en Suisse", () => {
    const paid = order("PAID", [
      { kind: "AUTHORIZATION", status: "SUCCESS", processedAt: "2026-11-09T10:00:00Z" },
      capture("2026-11-10T23:30:00Z"),
    ]);
    // 23 h 30 à Londres, 0 h 30 le lendemain à Zurich.
    expect(invoicePaymentOf(paid, TODAY)).toEqual({ kind: "payee", paidOn: "2026-11-11" });
  });

  it("ignore les paiements échoués et les remboursements pour dater le paiement", () => {
    const paid = order("PARTIALLY_REFUNDED", [
      { kind: "SALE", status: "SUCCESS", processedAt: "2026-11-05T09:00:00Z" },
      { kind: "SALE", status: "FAILURE", processedAt: "2026-11-06T09:00:00Z" },
      { kind: "REFUND", status: "SUCCESS", processedAt: "2026-11-07T09:00:00Z" },
    ]);
    expect(invoicePaymentOf(paid, TODAY)).toEqual({ kind: "payee", paidOn: "2026-11-05" });
  });

  it("date du jour quand Shopify ne donne aucun paiement daté", () => {
    expect(invoicePaymentOf(order("PAID"), TODAY)).toEqual({ kind: "payee", paidOn: TODAY });
  });

  it("refuse la QR-facture d'une commande payée en partie, à encaisser ou remboursée", () => {
    expect(invoicePaymentOf(order("PARTIALLY_PAID"), TODAY)).toEqual({ kind: "bloquee", code: "paiement_partiel" });
    expect(invoicePaymentOf(order("AUTHORIZED"), TODAY)).toEqual({ kind: "bloquee", code: "paiement_a_encaisser" });
    expect(invoicePaymentOf(order("REFUNDED"), TODAY)).toEqual({ kind: "bloquee", code: "commande_remboursee" });
  });
});
