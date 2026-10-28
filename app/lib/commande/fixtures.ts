import type { IsoDate } from "../metafields/definitions";
import type { CustomerNode, VariantNode } from "./queries";
import type { CustomerGid, PhoneOrderInput, ProductOption, VariantGid } from "./types";

/** Données de test de la commande par téléphone (aucun vrai client). */

export const VARIANT_A = "gid://shopify/ProductVariant/1" as VariantGid;
export const VARIANT_B = "gid://shopify/ProductVariant/2" as VariantGid;
export const CUSTOMER = "gid://shopify/Customer/10" as CustomerGid;

export function product(overrides: Partial<ProductOption> = {}): ProductOption {
  return {
    variantId: VARIANT_A,
    productTitle: "Chasselas de Lavaux",
    variantTitle: null,
    sku: "CHA-75",
    priceCents: 1850,
    available: 24,
    imageUrl: null,
    imageAlt: "Chasselas de Lavaux",
    ...overrides,
  };
}

export function order(overrides: Partial<PhoneOrderInput> = {}): PhoneOrderInput {
  return {
    idempotencyKey: "4f1c1d7e-3a51-4f0e-9a51-2b9d3c6b8a10",
    customerId: CUSTOMER,
    b2b: null,
    lines: [{ variantId: VARIANT_A, quantity: 12 }],
    requestedDate: "2026-10-23" as IsoDate,
    deadline: "2026-10-24" as IsoDate,
    mode: "livraison",
    note: "Sonner à l’arrière",
    payment: "facture",
    ...overrides,
  };
}

export function customerNode(overrides: Partial<CustomerNode> = {}): CustomerNode {
  return {
    id: CUSTOMER,
    displayName: "Marco Rossi",
    tags: [],
    lastOrder: null,
    defaultEmailAddress: { emailAddress: "marco@example.ch" },
    defaultPhoneNumber: { phoneNumber: "+41211234567" },
    defaultAddress: {
      firstName: "Marco",
      lastName: "Rossi",
      company: "La Poésia",
      address1: "Rue du Lac 4",
      address2: "",
      zip: "1095",
      city: "Lutry",
      provinceCode: "VD",
      countryCodeV2: "CH",
      phone: null,
      formatted: ["La Poésia", "Rue du Lac 4", "1095 Lutry VD", "Suisse"],
    },
    companyContactProfiles: [],
    ...overrides,
  };
}

export function variantNode(overrides: Partial<VariantNode> = {}): VariantNode {
  return {
    id: VARIANT_A,
    title: "Default Title",
    sku: "CHA-75",
    price: "18.5",
    inventoryQuantity: 24,
    inventoryItem: { tracked: true },
    product: {
      title: "Chasselas de Lavaux",
      hasOnlyDefaultVariant: true,
      featuredMedia: { preview: { image: { url: "https://cdn.shopify.com/a.jpg", altText: null } } },
    },
    ...overrides,
  };
}
