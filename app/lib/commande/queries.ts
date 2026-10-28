/**
 * Requêtes Admin GraphQL de la commande par téléphone (vérifiées champ par champ
 * sur le schéma Admin 2026-10). Lecture seule.
 */

export const CUSTOMER_SEARCH_LIMIT = 10;

const CUSTOMER_FIELDS = `
      id
      displayName
      tags
      lastOrder {
        name
        createdAt
        lineItems(first: 20) { nodes { currentQuantity variant { id } } }
      }
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
      defaultAddress {
        firstName lastName company address1 address2 zip city provinceCode countryCodeV2 phone formatted
      }`;

const B2B_FIELDS = `
      companyContactProfiles {
        id
        company { id name }
        roleAssignments(first: 10) { nodes { companyLocation { id name } } }
      }`;

/** Avec les profils d'entreprise (B2B). Chaînes composées : sans marqueur #graphql pour la génération de types. */
export const CUSTOMER_SEARCH_QUERY = `
query RechercheClients($first: Int!, $query: String!) {
  customers(first: $first, query: $query) {
    nodes {${CUSTOMER_FIELDS}${B2B_FIELDS}
    }
  }
}`;

/** Repli sans B2B : une boutique sans accès au B2B peut refuser `companyContactProfiles`. */
export const CUSTOMER_SEARCH_QUERY_WITHOUT_B2B = `
query RechercheClientsSansB2B($first: Int!, $query: String!) {
  customers(first: $first, query: $query) {
    nodes {${CUSTOMER_FIELDS}
    }
  }
}`;

export interface CustomerAddressNode {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly company: string | null;
  readonly address1: string | null;
  readonly address2: string | null;
  readonly zip: string | null;
  readonly city: string | null;
  readonly provinceCode: string | null;
  readonly countryCodeV2: string | null;
  readonly phone: string | null;
  readonly formatted: readonly string[];
}

export interface CompanyContactNode {
  readonly id: string;
  readonly company: { readonly id: string; readonly name: string };
  readonly roleAssignments: {
    readonly nodes: readonly { readonly companyLocation: { readonly id: string; readonly name: string } }[];
  };
}

export interface LastOrderNode {
  readonly name: string;
  readonly createdAt: string;
  readonly lineItems: { readonly nodes: readonly { readonly currentQuantity: number; readonly variant: { readonly id: string } | null }[] };
}

export interface CustomerNode {
  readonly id: string;
  readonly displayName: string;
  readonly tags: readonly string[];
  readonly lastOrder: LastOrderNode | null;
  readonly defaultEmailAddress: { readonly emailAddress: string } | null;
  readonly defaultPhoneNumber: { readonly phoneNumber: string } | null;
  readonly defaultAddress: CustomerAddressNode | null;
  /** Vide sur une boutique sans B2B (ou absent si la boutique n'y a pas accès). */
  readonly companyContactProfiles?: readonly CompanyContactNode[] | null;
}

export interface CustomerSearchData {
  readonly customers: { readonly nodes: readonly CustomerNode[] };
}

/** 100 variantes par page : environ 300 points de coût, bien sous la limite de 1000. */
export const CATALOG_PAGE_SIZE = 100;
export const CATALOG_MAX_VARIANTS = 500;

/** Valeur du filtre en minuscules : avec « product_status:ACTIVE », Shopify ne renvoie aucune variante. */
export const CATALOG_QUERY = `#graphql
query CatalogueTelephone($first: Int!, $after: String) {
  productVariants(first: $first, after: $after, query: "product_status:active", sortKey: FULL_TITLE) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      sku
      price
      inventoryQuantity
      inventoryItem { tracked }
      product {
        title
        hasOnlyDefaultVariant
        featuredMedia { preview { image { url altText } } }
      }
    }
  }
}`;

export interface VariantNode {
  readonly id: string;
  readonly title: string;
  readonly sku: string | null;
  /** Scalaire `Money` : décimal en texte, dans la devise de la boutique. */
  readonly price: string;
  readonly inventoryQuantity: number | null;
  readonly inventoryItem: { readonly tracked: boolean } | null;
  readonly product: {
    readonly title: string;
    readonly hasOnlyDefaultVariant: boolean;
    readonly featuredMedia: {
      readonly preview: { readonly image: { readonly url: string; readonly altText: string | null } | null } | null;
    } | null;
  };
}

export interface CatalogData {
  readonly productVariants: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly VariantNode[];
  };
}

/** Tous les modèles : « net N jours » pour la facture, « à l'expédition » pour le paiement à la livraison. */
export const PAYMENT_TERMS_TEMPLATES_QUERY = `#graphql
query ModelesConditionsPaiement {
  paymentTermsTemplates { id name paymentTermsType dueInDays }
}`;

export interface PaymentTermsTemplatesData {
  readonly paymentTermsTemplates: readonly {
    readonly id: string;
    readonly name: string;
    readonly paymentTermsType: string;
    readonly dueInDays: number | null;
  }[];
}

/** Adresse par défaut relue au moment de créer la commande (on ne se fie pas au navigateur). */
export const CUSTOMER_ADDRESS_QUERY = `#graphql
query AdresseClient($id: ID!) {
  customer(id: $id) {
    id
    defaultAddress {
      firstName lastName company address1 address2 zip city provinceCode countryCodeV2 phone formatted
    }
  }
}`;

export interface CustomerAddressData {
  readonly customer: { readonly id: string; readonly defaultAddress: CustomerAddressNode | null } | null;
}

/** État d'une provisoire : déjà terminée ? (reprise après une coupure entre deux étapes). */
export const DRAFT_ORDER_STATE_QUERY = `#graphql
query EtatCommandeProvisoire($id: ID!) {
  draftOrder(id: $id) { id status order { id name displayFinancialStatus } }
}`;

export interface DraftOrderStateData {
  readonly draftOrder: {
    readonly id: string;
    readonly status: string;
    readonly order: { readonly id: string; readonly name: string; readonly displayFinancialStatus: string | null } | null;
  } | null;
}
