import type { ShopifyMoneyBag, ShopifyOrderForInvoice } from "../shopify/types";

const chf = (amount: string): ShopifyMoneyBag => ({ shopMoney: { amount, currencyCode: "CHF" } });

/**
 * Commande réaliste telle que renvoyée par `SHOPIFY_ORDER_INVOICE_QUERY` :
 * deux vins, livraison, TVA 8,1 % comprise dans les prix.
 * 36 × 24.00 + 24 × 28.00 = 1’536.00 ; + 15.00 de livraison = 1’551.00 ; TVA incluse 116.22.
 */
export const COMMANDE_SHOPIFY: ShopifyOrderForInvoice = {
  name: "#1042",
  createdAt: "2026-10-14T21:47:12Z",
  customer: { displayName: "Claire Monnier", defaultEmailAddress: { emailAddress: "claire@le-pressoir.ch" } },
  billingAddress: {
    name: "Claire Monnier",
    firstName: "Claire",
    lastName: "Monnier",
    company: "Restaurant Le Pressoir",
    address1: "Chemin des Vignes 3b",
    address2: null,
    zip: "1096",
    city: "Cully",
    countryCodeV2: "CH",
  },
  shippingAddress: null,
  lineItems: {
    nodes: [
      {
        title: "Merlot del Ticino Picaia 2022 Bio Suisse",
        variantTitle: "75 cl",
        vendor: "Bianchi",
        quantity: 36,
        originalUnitPriceSet: chf("24.0"),
        discountedTotalSet: chf("864.0"),
      },
      {
        title: "Alma Bio IGT",
        variantTitle: "75 cl",
        vendor: "Bianchi",
        quantity: 24,
        originalUnitPriceSet: chf("28.0"),
        discountedTotalSet: chf("672.0"),
      },
    ],
  },
  shippingLine: { title: "Livraison Suisse romande", discountedPriceSet: chf("15.0") },
  taxLines: [{ title: "TVA", rate: 0.081, ratePercentage: 8.1, priceSet: chf("116.22") }],
  taxesIncluded: true,
  subtotalPriceSet: chf("1536.0"),
  totalPriceSet: chf("1551.0"),
  discountCodes: [],
  poNumber: "PO-2026-118",
};

export const META_EXEMPLE = {
  invoiceNumber: "BP-2026-0042",
  issueDate: "2026-10-21",
  deliveryDate: "2026-10-20",
} as const;
