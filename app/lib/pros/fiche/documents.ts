/**
 * Requêtes de la fiche pro à compléter depuis le site (Admin API 2026-10, `write_customers`), et la forme de leurs
 * réponses. La lecture ne demande que ce que la fiche affiche ou vérifie : rien d'autre ne sort de Shopify.
 */

export const FICHE_QUERY = `#graphql
query FichePro($id: ID!) {
  customer(id: $id) {
    id
    firstName
    lastName
    defaultPhoneNumber { phoneNumber }
    companyContactProfiles {
      company { name }
      roleAssignments(first: 10) {
        nodes { companyLocation { id phone shippingAddress { address1 zip city } billingAddress { address1 } } }
      }
    }
  }
}`;

export const CUSTOMER_UPDATE_MUTATION = `#graphql
mutation FicheProPersonne($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer { id }
    userErrors { field message }
  }
}`;

export const LOCATION_PHONE_MUTATION = `#graphql
mutation FicheProTelephone($companyLocationId: ID!, $input: CompanyLocationUpdateInput!) {
  companyLocationUpdate(companyLocationId: $companyLocationId, input: $input) {
    companyLocation { id }
    userErrors { field message code }
  }
}`;

export const LOCATION_ADDRESS_MUTATION = `#graphql
mutation FicheProAdresse($locationId: ID!, $address: CompanyAddressInput!, $addressTypes: [CompanyAddressType!]!) {
  companyLocationAssignAddress(locationId: $locationId, address: $address, addressTypes: $addressTypes) {
    addresses { id }
    userErrors { field message code }
  }
}`;

interface AddressData {
  readonly address1: string | null;
  readonly zip: string | null;
  readonly city: string | null;
}

export interface FicheLocationData {
  readonly id: string;
  readonly phone: string | null;
  readonly shippingAddress: AddressData | null;
  readonly billingAddress: { readonly address1: string | null } | null;
}

export interface FicheCustomerData {
  readonly customer: {
    readonly id: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly defaultPhoneNumber: { readonly phoneNumber: string } | null;
    readonly companyContactProfiles: readonly {
      readonly company: { readonly name: string };
      readonly roleAssignments: { readonly nodes: readonly { readonly companyLocation: FicheLocationData }[] };
    }[];
  } | null;
}
