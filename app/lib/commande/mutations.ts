import type { ShopifyUserError } from "../shopify/errors";

/**
 * Mutations Admin GraphQL de la commande par téléphone (vérifiées champ par champ
 * sur le schéma Admin 2026-10). `draftOrderComplete` n'a plus d'argument `paymentPending` :
 * sans conditions de paiement, la commande terminée est marquée payée.
 */

interface MoneyBagNode {
  readonly presentmentMoney: { readonly amount: string; readonly currencyCode: string };
}

export const DRAFT_ORDER_CALCULATE_MUTATION = `#graphql
mutation PrixCommandeB2B($input: DraftOrderInput!) {
  draftOrderCalculate(input: $input) {
    calculatedDraftOrder {
      currencyCode
      lineItems {
        quantity
        variant { id }
        approximateDiscountedUnitPriceSet { presentmentMoney { amount currencyCode } }
      }
      subtotalPriceSet { presentmentMoney { amount currencyCode } }
    }
    userErrors { field message }
  }
}`;

export interface CalculatedLineNode {
  readonly quantity: number;
  readonly variant: { readonly id: string } | null;
  readonly approximateDiscountedUnitPriceSet: MoneyBagNode;
}

export interface DraftOrderCalculateData {
  readonly draftOrderCalculate: {
    readonly calculatedDraftOrder: {
      readonly currencyCode: string;
      readonly lineItems: readonly CalculatedLineNode[];
      readonly subtotalPriceSet: MoneyBagNode;
    } | null;
    readonly userErrors: readonly ShopifyUserError[];
  } | null;
}

export const DRAFT_ORDER_CREATE_MUTATION = `#graphql
mutation CreerCommandeProvisoire($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name }
    userErrors { field message }
  }
}`;

/**
 * `paymentTerms` n'est volontairement pas relu : il exige `read_payment_terms`, et un refus
 * d'accès ferait échouer la réponse alors que la provisoire serait déjà créée.
 */
export interface CreatedDraftOrderNode {
  readonly id: string;
  readonly name: string;
}

export interface DraftOrderCreateData {
  readonly draftOrderCreate: {
    readonly draftOrder: CreatedDraftOrderNode | null;
    readonly userErrors: readonly ShopifyUserError[];
  } | null;
}

export const DRAFT_ORDER_COMPLETE_MUTATION = `#graphql
mutation TerminerCommandeProvisoire($id: ID!) {
  draftOrderComplete(id: $id) {
    draftOrder { id status order { id name displayFinancialStatus } }
    userErrors { field message }
  }
}`;

export interface CompletedOrderNode {
  readonly id: string;
  readonly name: string;
  readonly displayFinancialStatus: string | null;
}

export interface DraftOrderCompleteData {
  readonly draftOrderComplete: {
    readonly draftOrder: { readonly id: string; readonly status: string; readonly order: CompletedOrderNode | null } | null;
    readonly userErrors: readonly ShopifyUserError[];
  } | null;
}

export const METAFIELDS_SET_MUTATION = `#graphql
mutation PoserMetachampsLivraison($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { key namespace }
    userErrors { field message code }
  }
}`;

export interface MetafieldsSetData {
  readonly metafieldsSet: {
    readonly metafields: readonly { readonly key: string; readonly namespace: string }[] | null;
    readonly userErrors: readonly ShopifyUserError[];
  } | null;
}
