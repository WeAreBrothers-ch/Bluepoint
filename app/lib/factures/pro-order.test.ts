import { describe, expect, it } from "vitest";
import { isFullyPaid, isProOrder, receiptSkipReason, toReceiptFacts, type ReceiptOrderData } from "./pro-order";

const commande: ReceiptOrderData = {
  tags: [],
  displayFinancialStatus: "PAID",
  customer: { tags: [] },
  purchasingEntity: null,
  dateSouhaitee: null,
};

describe("commande d'un professionnel", () => {
  it("reconnaît un client marqué « pro », quelle que soit la casse", () => {
    expect(isProOrder(toReceiptFacts({ ...commande, customer: { tags: ["vip", " Pro "] } }))).toBe(true);
  });

  it("reconnaît un acheteur rattaché à une entreprise Shopify", () => {
    expect(isProOrder(toReceiptFacts({ ...commande, purchasingEntity: { __typename: "PurchasingCompany" } }))).toBe(true);
  });

  it("ignore un particulier, y compris sans compte client", () => {
    expect(isProOrder(toReceiptFacts(commande))).toBe(false);
    expect(isProOrder(toReceiptFacts({ ...commande, customer: null }))).toBe(false);
    expect(isProOrder(toReceiptFacts({ ...commande, customer: { tags: ["professionnel"] } }))).toBe(false);
  });

  it("n'accepte que les commandes entièrement payées", () => {
    expect(isFullyPaid(toReceiptFacts(commande))).toBe(true);
    expect(isFullyPaid(toReceiptFacts({ ...commande, displayFinancialStatus: "PARTIALLY_PAID" }))).toBe(false);
    expect(isFullyPaid(toReceiptFacts({ ...commande, displayFinancialStatus: "PENDING" }))).toBe(false);
  });

  it("lit la date de livraison souhaitée, et ignore une valeur illisible", () => {
    expect(toReceiptFacts({ ...commande, dateSouhaitee: { value: "2026-10-26" } }).plannedDeliveryDate).toBe("2026-10-26");
    expect(toReceiptFacts({ ...commande, dateSouhaitee: { value: "26.10.2026" } }).plannedDeliveryDate).toBeNull();
  });
});

describe("reçu pro : quand ne pas le faire", () => {
  const pro = { ...commande, displayFinancialStatus: "PAID", customer: { tags: ["pro"] } };

  it("pro soldé : le reçu se fait", () => {
    expect(receiptSkipReason(toReceiptFacts(pro))).toBeNull();
  });

  it("commande d'essai (étiquette sur la commande ou sur le client) : pas de reçu, sa facture naît du bon AbaNinja", () => {
    expect(receiptSkipReason(toReceiptFacts({ ...pro, tags: ["fictif"] }))).toContain("essai");
    expect(receiptSkipReason(toReceiptFacts({ ...pro, customer: { tags: ["pro", "fictif"] } }))).toContain("essai");
  });

  it("particulier ou pas soldé : pas de reçu", () => {
    expect(receiptSkipReason(toReceiptFacts({ ...pro, customer: null }))).not.toBeNull();
    expect(receiptSkipReason(toReceiptFacts({ ...pro, displayFinancialStatus: "PENDING" }))).not.toBeNull();
  });
});
