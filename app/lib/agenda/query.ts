/**
 * Requête Admin GraphQL de l'agenda (vérifiée sur le schéma Admin 2026-10).
 * 50 commandes par page : avec les métachamps, l'entité acheteuse et les expéditions,
 * une page de 100 dépasserait la limite de coût de 1000 points par requête.
 */

export const AGENDA_PAGE_SIZE = 50;
/** Plafond de commandes chargées par affichage (un avis s'affiche s'il est atteint). */
export const AGENDA_MAX_ORDERS = 300;

export const AGENDA_ORDERS_QUERY = `#graphql
query AgendaCommandes($first: Int!, $after: String, $query: String!) {
  orders(first: $first, after: $after, query: $query, sortKey: PROCESSED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      name
      cancelledAt
      displayFulfillmentStatus
      displayFinancialStatus
      customer { displayName tags }
      purchasingEntity {
        __typename
        ... on PurchasingCompany { company { name } }
      }
      shippingAddress { name city company }
      customAttributes { key value }
      dateSouhaitee: metafield(namespace: "$app", key: "livraison_date_souhaitee") { value }
      dateLimite: metafield(namespace: "$app", key: "livraison_date_limite") { value }
      mode: metafield(namespace: "$app", key: "livraison_mode") { value }
      fulfillments(first: 5) { status displayStatus }
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
  readonly displayFulfillmentStatus: string;
  readonly displayFinancialStatus: string | null;
  readonly customer: { readonly displayName: string; readonly tags: readonly string[] } | null;
  readonly purchasingEntity:
    | { readonly __typename: "PurchasingCompany"; readonly company: { readonly name: string } | null }
    | { readonly __typename: "Customer" }
    | null;
  readonly shippingAddress: {
    readonly name: string | null;
    readonly city: string | null;
    readonly company: string | null;
  } | null;
  readonly customAttributes: readonly { readonly key: string; readonly value: string | null }[];
  readonly dateSouhaitee: MetafieldValue | null;
  readonly dateLimite: MetafieldValue | null;
  readonly mode: MetafieldValue | null;
  readonly fulfillments: readonly { readonly status: string; readonly displayStatus: string | null }[];
}

export interface AgendaOrdersData {
  readonly orders: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly AgendaOrderNode[];
  };
}
