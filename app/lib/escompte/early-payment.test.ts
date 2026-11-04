import { describe, expect, it } from "vitest";
import { d } from "../agenda/fixtures";
import { earlyPaymentAmounts, earlyPaymentDeadline, earlyPaymentOffer } from "./early-payment";

const invoice = { issueDate: "2026-11-04", dueDate: "2026-12-04", totalCents: 78000, paidOn: null };

describe("rabais de paiement rapide", () => {
  it("calcule 2 % du total, au centime", () => {
    expect(earlyPaymentAmounts(78000)).toEqual({ discountCents: 1560, amountCents: 76440 });
    // Le même résultat que Shopify sur une vraie commande : 229.50 → 224.91.
    expect(earlyPaymentAmounts(22950)).toEqual({ discountCents: 459, amountCents: 22491 });
    expect(earlyPaymentAmounts(10001).discountCents).toBe(200);
  });

  it("donne dix jours à partir de la date de la facture, ce dernier jour compris", () => {
    expect(earlyPaymentDeadline("2026-11-04")).toBe("2026-11-14");
    expect(earlyPaymentDeadline("2026-12-28")).toBe("2027-01-07");
    expect(earlyPaymentDeadline("pas une date")).toBeNull();
  });

  it("propose le rabais jusqu'au dernier jour", () => {
    expect(earlyPaymentOffer(invoice, d("2026-11-04"))).toMatchObject({ percent: 2, deadline: "2026-11-14", amountCents: 76440 });
    expect(earlyPaymentOffer(invoice, d("2026-11-14"))).not.toBeNull();
  });

  it("ne propose plus rien après le délai, ni pour un reçu déjà payé", () => {
    expect(earlyPaymentOffer(invoice, d("2026-11-15"))).toBeNull();
    expect(earlyPaymentOffer({ ...invoice, paidOn: "2026-11-04" }, d("2026-11-05"))).toBeNull();
  });

  it("ne propose rien quand l'échéance tombe dans les dix jours", () => {
    expect(earlyPaymentOffer({ ...invoice, dueDate: "2026-11-04" }, d("2026-11-04"))).toBeNull();
    expect(earlyPaymentOffer({ ...invoice, dueDate: "2026-11-14" }, d("2026-11-04"))).toBeNull();
    expect(earlyPaymentOffer({ ...invoice, dueDate: "2026-11-15" }, d("2026-11-04"))).not.toBeNull();
  });

  it("ne propose rien pour un total nul ou une date illisible", () => {
    expect(earlyPaymentOffer({ ...invoice, totalCents: 0 }, d("2026-11-05"))).toBeNull();
    expect(earlyPaymentOffer({ ...invoice, issueDate: "n'importe quoi" }, d("2026-11-05"))).toBeNull();
  });
});
