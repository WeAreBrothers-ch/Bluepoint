import { describe, expect, it } from "vitest";
import { FactureError } from "../erreurs";
import { COMMANDE_SHOPIFY, META_EXEMPLE } from "../fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../fixtures/vendeur";
import { mapShopifyOrderToInvoiceInput } from "./mapping";
import type { ShopifyOrderForInvoice } from "./types";

const chf = (amount: string) => ({ shopMoney: { amount, currencyCode: "CHF" } });

function mapper(commande: ShopifyOrderForInvoice = COMMANDE_SHOPIFY) {
  return mapShopifyOrderToInvoiceInput(commande, VENDEUR_EXEMPLE, META_EXEMPLE);
}

describe("mapShopifyOrderToInvoiceInput", () => {
  it("transforme une commande de deux vins, livraison et TVA 8,1 % comprise", () => {
    const facture = mapper();
    expect(facture.lines).toEqual([
      { description: "Merlot del Ticino Picaia 2022 Bio Suisse", producer: "Bianchi", volumeLabel: "75 cl", quantity: 36, unitPriceCents: 2400, totalCents: 86400 },
      { description: "Alma Bio IGT", producer: "Bianchi", volumeLabel: "75 cl", quantity: 24, unitPriceCents: 2800, totalCents: 67200 },
    ]);
    expect(facture.shipping).toEqual({ label: "Livraison Suisse romande", amountCents: 1500 });
    expect(facture.discounts).toEqual([]);
    expect(facture.vatLines).toEqual([{ ratePercent: 8.1, amountCents: 11622 }]);
    expect(facture.taxesIncluded).toBe(true);
    expect(facture.totalCents).toBe(155100);
    expect(facture.buyer).toEqual({
      name: "Claire Monnier",
      company: "Restaurant Le Pressoir",
      street: "Chemin des Vignes",
      buildingNumber: "3b",
      postalCode: "1096",
      city: "Cully",
      country: "CH",
    });
    expect(facture).toMatchObject({
      orderReference: "#1042",
      orderDate: "2026-10-14",
      poNumber: "PO-2026-118",
      dueDate: "2026-11-20",
      paymentTerms: "Payable à 30 jours",
    });
  });

  it("déduit le rabais de commande du sous-total Shopify", () => {
    const facture = mapper({
      ...COMMANDE_SHOPIFY,
      currentSubtotalPriceSet: chf("1382.4"),
      currentTotalPriceSet: chf("1397.4"),
      currentTaxLines: [{ title: "TVA", ratePercentage: 8.1, priceSet: chf("104.71") }],
      discountCodes: ["PRO10"],
    });
    expect(facture.discounts).toEqual([{ label: "Rabais (PRO10)", amountCents: 15360 }]);
  });

  it("nomme la remise automatique sur la facture (ex. « Prix pro -15 % »)", () => {
    const facture = mapper({
      ...COMMANDE_SHOPIFY,
      currentSubtotalPriceSet: chf("1305.6"),
      currentTotalPriceSet: chf("1320.6"),
      currentTaxLines: [{ title: "TVA", ratePercentage: 8.1, priceSet: chf("98.99") }],
      discountApplications: { nodes: [{ title: "Prix pro -15 %" }, {}] },
    });
    expect(facture.discounts).toEqual([{ label: "Rabais (Prix pro -15 %)", amountCents: 23040 }]);
  });

  it("produit une facture acquittée : payée le jour même, sans échéance à venir", () => {
    const facture = mapShopifyOrderToInvoiceInput(COMMANDE_SHOPIFY, VENDEUR_EXEMPLE, { ...META_EXEMPLE, paidOn: META_EXEMPLE.issueDate });
    expect(facture).toMatchObject({ paidOn: META_EXEMPLE.issueDate, dueDate: META_EXEMPLE.issueDate, paymentTerms: "Payée en ligne" });
  });

  it("facture les vins restants après « Modifier les vins » : bouteilles retirées et ligne supprimée", () => {
    const [merlot, alma] = COMMANDE_SHOPIFY.lineItems.nodes;
    if (merlot === undefined || alma === undefined) throw new Error("commande d'exemple incomplète");
    // 12 Merlot retirés sur 36 et l'Alma supprimé : Shopify garde la quantité commandée, et un total qui les compte encore.
    const facture = mapper({
      ...COMMANDE_SHOPIFY,
      lineItems: { nodes: [{ ...merlot, currentQuantity: 24 }, { ...alma, currentQuantity: 0 }] },
      currentSubtotalPriceSet: chf("576.0"),
      currentTotalPriceSet: chf("591.0"),
      currentTaxLines: [{ title: "TVA", rate: 0.081, ratePercentage: 8.1, priceSet: chf("44.29") }],
    });
    expect(facture.lines).toEqual([
      { description: "Merlot del Ticino Picaia 2022 Bio Suisse", producer: "Bianchi", volumeLabel: "75 cl", quantity: 24, unitPriceCents: 2400, totalCents: 57600 },
    ]);
    expect(facture.discounts).toEqual([]);
    expect(facture.vatLines).toEqual([{ ratePercent: 8.1, amountCents: 4429 }]);
    expect(facture.totalCents).toBe(59100);
  });

  it("n'invente pas de rabais d'un centime quand la part des bouteilles restantes s'arrondit", () => {
    const [merlot] = COMMANDE_SHOPIFY.lineItems.nodes;
    if (merlot === undefined) throw new Error("commande d'exemple incomplète");
    // 7 bouteilles à 100.00 au total, 3 gardées : 42.857… arrondi à 42.86, Shopify en compte 42.85.
    const facture = mapper({
      ...COMMANDE_SHOPIFY,
      lineItems: { nodes: [{ ...merlot, quantity: 7, currentQuantity: 3, discountedTotalSet: chf("100.0") }] },
      currentSubtotalPriceSet: chf("42.85"),
      currentTotalPriceSet: chf("57.85"),
      currentTaxLines: [{ title: "TVA", rate: 0.081, ratePercentage: 8.1, priceSet: chf("4.33") }],
    });
    expect(facture.lines).toMatchObject([{ quantity: 3, totalCents: 4286 }]);
    expect(facture.discounts).toEqual([]);
    expect(facture.totalCents).toBe(5785);
  });

  it("prend la livraison actuelle de la commande", () => {
    const facture = mapper({ ...COMMANDE_SHOPIFY, currentShippingPriceSet: chf("0.0"), currentTotalPriceSet: chf("1536.0") });
    expect(facture.shipping).toEqual({ label: "Livraison Suisse romande", amountCents: 0 });
    expect(facture.totalCents).toBe(153600);
  });

  it("regroupe les lignes de TVA par taux et accepte le taux décimal", () => {
    const taxLines = [
      { title: "TVA", rate: 0.081, priceSet: chf("110.00") },
      { title: "TVA livraison", rate: 0.081, priceSet: chf("6.22") },
    ];
    expect(mapper({ ...COMMANDE_SHOPIFY, currentTaxLines: taxLines }).vatLines).toEqual([{ ratePercent: 8.1, amountCents: 11622 }]);
  });

  it("explique quoi corriger quand le numéro de rue manque", () => {
    const sansNumero = { ...COMMANDE_SHOPIFY, billingAddress: { ...COMMANDE_SHOPIFY.billingAddress, address1: "Chemin des Vignes" } };
    expect(() => mapper(sansNumero)).toThrow(/sans numéro de rue.*Corriger l'adresse de la commande dans Shopify/);
  });

  it("refuse une commande dans une autre devise", () => {
    const euros = { ...COMMANDE_SHOPIFY, currentTotalPriceSet: { shopMoney: { amount: "1551.0", currencyCode: "EUR" } } };
    expect(() => mapper(euros)).toThrow(FactureError);
  });

  it("signale un total Shopify qui ne correspond pas aux lignes", () => {
    expect(() => mapper({ ...COMMANDE_SHOPIFY, currentTotalPriceSet: chf("1560.0") })).toThrow(/Total incohérent/);
  });

  it("refuse une commande sans adresse de facturation ni de livraison", () => {
    expect(() => mapper({ ...COMMANDE_SHOPIFY, billingAddress: null })).toThrow(/aucune adresse de facturation/);
  });
});
