import { describe, expect, it } from "vitest";
import { paidGatewayOf, paymentTypeOf } from "./vente-paiement";

describe("type du paiement inscrit dans AbaNinja, d'après le moyen de paiement Shopify", () => {
  it("carte : Shopify Payments, Stripe et la passerelle de test de Shopify", () => {
    expect(paymentTypeOf("shopify_payments")).toBe("DEBIT_CREDIT_CARD");
    expect(paymentTypeOf("Stripe")).toBe("DEBIT_CREDIT_CARD");
    expect(paymentTypeOf("bogus")).toBe("DEBIT_CREDIT_CARD");
  });

  it("TWINT, où que le mot apparaisse", () => {
    expect(paymentTypeOf("Datatrans TWINT")).toBe("TWINT");
  });

  it("PayPal", () => {
    expect(paymentTypeOf("paypal")).toBe("PAYPAL");
  });

  it("espèces", () => {
    expect(paymentTypeOf("Cash on Delivery (COD)")).toBe("CASH");
    expect(paymentTypeOf("Paiement en espèces")).toBe("CASH");
  });

  it("le reste (payé à la main, virement…) : espèces, le nom du moyen reste dans la note interne", () => {
    expect(paymentTypeOf("manual")).toBe("CASH");
    expect(paymentTypeOf("")).toBe("CASH");
  });
});

describe("moyen de paiement d'une commande payée", () => {
  it("prend le dernier paiement réussi", () => {
    const transactions = [
      { kind: "AUTHORIZATION", status: "SUCCESS", processedAt: "2026-11-10T08:00:00Z", gateway: "paypal" },
      { kind: "SALE", status: "FAILURE", processedAt: "2026-11-10T08:10:00Z", gateway: "paypal" },
      { kind: "SALE", status: "SUCCESS", processedAt: "2026-11-10T08:15:00Z", gateway: "shopify_payments" },
    ];
    expect(paidGatewayOf(transactions)).toBe("shopify_payments");
  });

  it("dit « inconnu » quand Shopify ne le donne pas", () => {
    expect(paidGatewayOf([{ kind: "SALE", status: "SUCCESS", processedAt: null }])).toBe("inconnu");
    expect(paidGatewayOf([])).toBe("inconnu");
  });
});
