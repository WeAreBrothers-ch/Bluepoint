/**
 * Sous-ensemble exact des champs de la commande Shopify (Admin GraphQL, objet `Order`)
 * nécessaires à la facture. La requête correspondante est `SHOPIFY_ORDER_INVOICE_QUERY`.
 */

export interface ShopifyMoney {
  /** Montant décimal en texte, ex. « 24.0 ». */
  amount: string;
  currencyCode: string;
}

export interface ShopifyMoneyBag {
  /** Devise de la boutique (CHF) : seule cette valeur est utilisée. */
  shopMoney: ShopifyMoney;
}

export interface ShopifyMailingAddress {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  zip?: string | null;
  city?: string | null;
  countryCodeV2?: string | null;
}

export interface ShopifyCustomer {
  displayName?: string | null;
  /** `Customer.email` n'existe plus en Admin API 2026-10 : on lit l'adresse par défaut. */
  defaultEmailAddress?: { emailAddress?: string | null } | null;
}

export interface ShopifyLineItem {
  title: string;
  variantTitle?: string | null;
  /** Fournisseur Shopify : chez BluePoint, le domaine producteur. */
  vendor?: string | null;
  quantity: number;
  originalUnitPriceSet: ShopifyMoneyBag;
  /** Total de la ligne après rabais propres à la ligne (hors rabais sur la commande). */
  discountedTotalSet: ShopifyMoneyBag;
}

export interface ShopifyShippingLine {
  title: string;
  /** Prix de la livraison après rabais sur la livraison. */
  discountedPriceSet: ShopifyMoneyBag;
}

export interface ShopifyTaxLine {
  title: string;
  /** Taux décimal, ex. 0.081. */
  rate?: number | null;
  /** Taux en pourcent, ex. 8.1. */
  ratePercentage?: number | null;
  priceSet: ShopifyMoneyBag;
}

export interface ShopifyOrderForInvoice {
  /** Numéro lisible de la commande, ex. « #1042 ». */
  name: string;
  /** Horodatage ISO 8601 de la commande. */
  createdAt: string;
  customer?: ShopifyCustomer | null;
  billingAddress?: ShopifyMailingAddress | null;
  shippingAddress?: ShopifyMailingAddress | null;
  lineItems: { nodes: readonly ShopifyLineItem[] };
  shippingLine?: ShopifyShippingLine | null;
  taxLines: readonly ShopifyTaxLine[];
  taxesIncluded: boolean;
  /** Somme des articles après tous les rabais (TVA comprise si `taxesIncluded`). */
  subtotalPriceSet: ShopifyMoneyBag;
  totalPriceSet: ShopifyMoneyBag;
  discountCodes?: readonly string[] | null;
  /** Remises automatiques appliquées (seul `title` nous intéresse) : ex. « Prix pro -15 % ». */
  discountApplications?: { nodes: readonly { title?: string | null }[] } | null;
  poNumber?: string | null;
}
