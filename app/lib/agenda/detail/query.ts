/**
 * Détail d'une commande, chargé à l'ouverture de la fenêtre de l'agenda
 * (requête vérifiée sur la boutique, schéma Admin 2026-10).
 */

/** Au-delà, la fenêtre signale que la liste est incomplète. */
export const DETAIL_MAX_LINES = 100;

export const ORDER_DETAIL_QUERY = `#graphql
query DetailCommande($id: ID!, $lines: Int!) {
  order(id: $id) {
    id
    name
    createdAt
    note
    email
    phone
    customer { displayName email phone }
    shippingAddress { name company address1 address2 zip city phone }
    lineItems(first: $lines) {
      pageInfo { hasNextPage }
      nodes {
        id
        title
        variantTitle
        quantity
        originalUnitPriceSet { shopMoney { amount } }
      }
    }
    totalDiscountsSet { shopMoney { amount } }
    totalShippingPriceSet { shopMoney { amount } }
    totalTaxSet { shopMoney { amount } }
    taxesIncluded
    totalPriceSet { shopMoney { amount } }
    totalOutstandingSet { shopMoney { amount } }
    paymentTerms { paymentTermsName paymentSchedules(first: 1) { nodes { dueAt } } }
  }
}`;

interface Money {
  readonly shopMoney: { readonly amount: string };
}

export interface DetailLineNode {
  readonly id: string;
  readonly title: string;
  readonly variantTitle: string | null;
  readonly quantity: number;
  readonly originalUnitPriceSet: Money;
}

export interface OrderDetailNode {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly note: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly customer: {
    readonly displayName: string;
    readonly email: string | null;
    readonly phone: string | null;
  } | null;
  readonly shippingAddress: {
    readonly name: string | null;
    readonly company: string | null;
    readonly address1: string | null;
    readonly address2: string | null;
    readonly zip: string | null;
    readonly city: string | null;
    readonly phone: string | null;
  } | null;
  readonly lineItems: {
    readonly pageInfo: { readonly hasNextPage: boolean };
    readonly nodes: readonly DetailLineNode[];
  };
  readonly totalDiscountsSet: Money;
  readonly totalShippingPriceSet: Money;
  readonly totalTaxSet: Money;
  readonly taxesIncluded: boolean;
  readonly totalPriceSet: Money;
  readonly totalOutstandingSet: Money;
  readonly paymentTerms: {
    readonly paymentTermsName: string;
    readonly paymentSchedules: { readonly nodes: readonly { readonly dueAt: string | null }[] };
  } | null;
}

export interface OrderDetailData {
  readonly order: OrderDetailNode | null;
}
