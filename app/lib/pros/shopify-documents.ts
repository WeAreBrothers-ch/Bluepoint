/** Requêtes et mutations Shopify de la création d'un compte pro (Admin API 2026-10), et la forme de leurs réponses. */

export const ACCESS_QUERY = `#graphql
query AutorisationsApp { currentAppInstallation { accessScopes { handle } } }`;

export const CUSTOMER_BY_EMAIL_QUERY = `#graphql
query ClientParEmail($query: String!) {
  customers(first: 10, query: $query) {
    nodes { id defaultEmailAddress { emailAddress } companyContactProfiles { id company { id name } } }
  }
}`;

export const COMPANY_QUERY = `#graphql
query LireEntreprise($id: ID!) {
  company(id: $id) {
    id
    contactRoles(first: 10) { nodes { id name } }
    locations(first: 1) { nodes { id } }
    contacts(first: 20) {
      nodes {
        id
        customer { id defaultEmailAddress { emailAddress } }
        roleAssignments(first: 5) { nodes { companyLocation { id } } }
      }
    }
  }
}`;

export const COMPANY_CREATE_MUTATION = `#graphql
mutation CreerEntreprisePro($input: CompanyCreateInput!) {
  companyCreate(input: $input) {
    company { id }
    userErrors { field message code }
  }
}`;

export const ASSIGN_CUSTOMER_MUTATION = `#graphql
mutation RattacherClient($companyId: ID!, $customerId: ID!) {
  companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
    companyContact { id }
    userErrors { field message code }
  }
}`;

export const ASSIGN_ROLE_MUTATION = `#graphql
mutation DonnerRole($companyContactId: ID!, $companyContactRoleId: ID!, $companyLocationId: ID!) {
  companyContactAssignRole(companyContactId: $companyContactId, companyContactRoleId: $companyContactRoleId, companyLocationId: $companyLocationId) {
    companyContactRoleAssignment { id }
    userErrors { field message code }
  }
}`;

export const TAGS_ADD_MUTATION = `#graphql
mutation EtiquettePro($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    userErrors { field message }
  }
}`;

export const WELCOME_EMAIL_MUTATION = `#graphql
mutation InvitationPro($companyContactId: ID!) {
  companyContactSendWelcomeEmail(companyContactId: $companyContactId) {
    companyContact { id }
    userErrors { field message code }
  }
}`;

export interface UserErrorList {
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string; readonly code?: string | null }[];
}

export interface AccessData {
  readonly currentAppInstallation: { readonly accessScopes: readonly { readonly handle: string }[] };
}

export interface CustomerByEmailData {
  readonly customers: {
    readonly nodes: readonly {
      readonly id: string;
      readonly defaultEmailAddress: { readonly emailAddress: string } | null;
      readonly companyContactProfiles: readonly { readonly id: string; readonly company: { readonly id: string; readonly name: string } }[];
    }[];
  };
}

export interface CompanyData {
  readonly company: {
    readonly id: string;
    readonly contactRoles: { readonly nodes: readonly { readonly id: string; readonly name: string }[] };
    readonly locations: { readonly nodes: readonly { readonly id: string }[] };
    readonly contacts: {
      readonly nodes: readonly {
        readonly id: string;
        readonly customer: { readonly id: string; readonly defaultEmailAddress: { readonly emailAddress: string } | null } | null;
        readonly roleAssignments: { readonly nodes: readonly { readonly companyLocation: { readonly id: string } }[] };
      }[];
    };
  } | null;
}
