import type { AbaNinjaSale } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { saleSummaryLabel, summarize } from "./vente-essai-resume";

const SALE: AbaNinjaSale = {
  id: "v1",
  shop: "test.myshopify.com",
  orderId: "gid://shopify/Order/1035",
  orderName: "#1035",
  isTest: true,
  reference: "BP-ESSAI-CMD-1035-20261119-110530",
  noteState: "cree",
  noteUuid: "66666666-6666-4666-8666-666666666666",
  noteNumber: "L00042",
  addressUuid: "22222222-2222-4222-8222-222222222222",
  companyUuid: "33333333-3333-4333-8333-333333333333",
  invoiceState: null,
  invoiceUuid: null,
  invoiceNumber: null,
  paymentState: null,
  lastErrorCode: null,
  createdAt: new Date("2026-11-19T11:05:30Z"),
  updatedAt: new Date("2026-11-19T11:05:30Z"),
};

describe("résumé des essais faits par les commandes fictives", () => {
  it("bon seul, puis bon réglé avec sa facture payée", () => {
    expect(saleSummaryLabel(SALE)).toBe("bon n° L00042");
    expect(saleSummaryLabel({ ...SALE, noteState: "converti", invoiceState: "creee", invoiceNumber: "R02292", paymentState: "inscrit" })).toBe(
      "bon n° L00042 réglé · facture R02292, payée",
    );
  });

  it("dit ce qui est à vérifier dans AbaNinja", () => {
    expect(saleSummaryLabel({ ...SALE, noteState: "incertain", noteNumber: null })).toBe("bon à vérifier dans AbaNinja");
    expect(saleSummaryLabel({ ...SALE, noteState: "converti", invoiceState: "incertaine" })).toBe("bon n° L00042 réglé · facture à vérifier dans AbaNinja");
  });

  it("rien à effacer : le dit simplement", () => {
    expect(summarize([])).toEqual({ tone: "success", heading: "Aucun essai à effacer", details: [] });
  });

  it("une ligne gardée l'emporte sur le reste", () => {
    const outcome = summarize([
      { kind: "effacee", text: "#1035 : effacé." },
      { kind: "gardee", text: "#1036 : réessayez." },
    ]);
    expect(outcome).toMatchObject({ tone: "warning", heading: "Une partie n’a pas pu être effacée" });
  });
});
