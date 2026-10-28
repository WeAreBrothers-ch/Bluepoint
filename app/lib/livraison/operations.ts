/** Opérations Admin GraphQL de la livraison (vérifiées sur le schéma Admin 2026-10). */

export const DELIVERY_STATE_QUERY = `#graphql
query EtatLivraison($id: ID!) {
  order(id: $id) {
    id
    name
    cancelledAt
    displayFulfillmentStatus
    fulfillmentOrders(first: 20, displayable: true) {
      nodes { id status supportedActions { action } }
    }
    fulfillments(first: 20) { id status displayStatus }
  }
}`;

export const FULFILLMENT_CREATE_MUTATION = `#graphql
mutation CreerExpedition($fulfillment: FulfillmentInput!) {
  fulfillmentCreate(fulfillment: $fulfillment) {
    fulfillment { id status displayStatus }
    userErrors { field message }
  }
}`;

export const FULFILLMENT_EVENT_CREATE_MUTATION = `#graphql
mutation MarquerLivree($fulfillmentEvent: FulfillmentEventInput!) {
  fulfillmentEventCreate(fulfillmentEvent: $fulfillmentEvent) {
    fulfillmentEvent { id status }
    userErrors { field message }
  }
}`;

export interface DeliveryFulfillmentOrder {
  readonly id: string;
  readonly status: string;
  readonly supportedActions: readonly { readonly action: string }[];
}

export interface DeliveryFulfillment {
  readonly id: string;
  readonly status: string;
  readonly displayStatus: string | null;
}

export interface DeliveryOrderState {
  readonly id: string;
  readonly name: string;
  readonly cancelledAt: string | null;
  readonly displayFulfillmentStatus: string;
  readonly fulfillmentOrders: { readonly nodes: readonly DeliveryFulfillmentOrder[] };
  readonly fulfillments: readonly DeliveryFulfillment[];
}

export interface DeliveryStateData {
  readonly order: DeliveryOrderState | null;
}

export interface FulfillmentCreateData {
  readonly fulfillmentCreate: {
    readonly fulfillment: DeliveryFulfillment | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}

export interface FulfillmentEventCreateData {
  readonly fulfillmentEventCreate: {
    readonly fulfillmentEvent: { readonly id: string; readonly status: string } | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}
