/**
 * Requête Admin GraphQL de l'agenda (vérifiée sur le schéma Admin 2026-10).
 * 25 commandes par page : avec les métachamps, l'entité acheteuse, les expéditions
 * et les 10 premières lignes, une page plus grande approcherait la limite de coût
 * de 1000 points par requête.
 */

export const AGENDA_PAGE_SIZE = 25;
/** Plafond de commandes chargées par affichage (un avis s'affiche s'il est atteint). */
export const AGENDA_MAX_ORDERS = 300;

/** Champs d'une commande lus par l'agenda. */
const AGENDA_ORDER_FIELDS = `
      id
      name
      cancelledAt
      note
      displayFulfillmentStatus
      displayFinancialStatus
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customer { displayName tags defaultPhoneNumber { phoneNumber } }
      purchasingEntity {
        __typename
        ... on PurchasingCompany { company { name } }
      }
      shippingAddress { name city company address1 address2 zip phone }
      customAttributes { key value }
      lineItems(first: 10) { nodes { name currentQuantity } }
      dateSouhaitee: metafield(namespace: "$app", key: "livraison_date_souhaitee") { value }
      dateLimite: metafield(namespace: "$app", key: "livraison_date_limite") { value }
      mode: metafield(namespace: "$app", key: "livraison_mode") { value }
      fulfillments(first: 5) { status displayStatus createdAt }`;

export const AGENDA_ORDERS_QUERY = `#graphql
query AgendaCommandes($first: Int!, $after: String, $query: String!) {
  orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {${AGENDA_ORDER_FIELDS}
    }
  }
}`;

interface MetafieldValue {
  readonly value: string;
}

export interface AgendaOrderNode {
  readonly id: string;
  readonly name: string;
  readonly cancelledAt: string | null;
  readonly note: string | null;
  readonly displayFulfillmentStatus: string;
  readonly displayFinancialStatus: string | null;
  readonly currentTotalPriceSet: { readonly shopMoney: { readonly amount: string; readonly currencyCode: string } } | null;
  readonly customer: {
    readonly displayName: string;
    readonly tags: readonly string[];
    readonly defaultPhoneNumber: { readonly phoneNumber: string } | null;
  } | null;
  readonly purchasingEntity:
    | { readonly __typename: "PurchasingCompany"; readonly company: { readonly name: string } | null }
    | { readonly __typename: "Customer" }
    | null;
  readonly shippingAddress: {
    readonly name: string | null;
    readonly city: string | null;
    readonly company: string | null;
    readonly address1: string | null;
    readonly address2: string | null;
    readonly zip: string | null;
    readonly phone: string | null;
  } | null;
  readonly customAttributes: readonly { readonly key: string; readonly value: string | null }[];
  readonly lineItems: { readonly nodes: readonly { readonly name: string; readonly currentQuantity: number }[] };
  readonly dateSouhaitee: MetafieldValue | null;
  readonly dateLimite: MetafieldValue | null;
  readonly mode: MetafieldValue | null;
  readonly fulfillments: readonly {
    readonly status: string;
    readonly displayStatus: string | null;
    readonly createdAt: string;
  }[];
}

export interface AgendaOrdersData {
  readonly orders: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly AgendaOrderNode[];
  };
}
