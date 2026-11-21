import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { pickCustomerWithEmail } from "./customer-match";
import { companyInput, type ProAccountInput } from "./company-input";
import {
  ACCESS_QUERY,
  CUSTOMER_BY_EMAIL_QUERY,
  COMPANY_QUERY,
  COMPANY_CREATE_MUTATION,
  ASSIGN_CUSTOMER_MUTATION,
  ASSIGN_ROLE_MUTATION,
  TAGS_ADD_MUTATION,
  WELCOME_EMAIL_MUTATION,
  type UserErrorList,
  type AccessData,
  type CustomerByEmailData,
  type CompanyData,
} from "./shopify-documents";

/**
 * « Accepter » une demande de compte pro dans Shopify (Admin API 2026-10, `write_customers`) :
 * 1. retrouver le client par son e-mail, identique à celui de la demande (il a peut-être déjà un compte de particulier) ;
 * 2. créer l'entreprise et son établissement, avec le paiement à N jours (bon de commande) ;
 * 3. rattacher la personne à l'établissement (rôle « Commande uniquement ») ;
 * 4. poser l’étiquette « pro » (le site et l’app reconnaissent ainsi un pro) ;
 * 5. envoyer l'e-mail d'invitation de Shopify (sauf `invite: false`).
 * Chaque étape peut être rejouée : un nouvel essai reprend l'entreprise déjà créée.
 */

export const PRO_TAG = "pro";

/** Scope nécessaire pour créer clients et entreprises. */
export const PRO_WRITE_SCOPE = "write_customers";

const ORDER_ONLY_ROLE = /commande uniquement|ordering only/i;

type CompanyNode = NonNullable<CompanyData["company"]>;

/** Où en est l'acceptation : l'entreprise créée est remontée même si une étape suivante échoue. */
export interface MakeProSuccess {
  readonly companyId: string;
  readonly customerId: string;
  /** La personne était déjà rattachée à une entreprise : rien n'a été créé. */
  readonly alreadyPro: boolean;
  readonly invited: boolean;
}

export class MakeProFailure extends Error {
  override readonly name = "MakeProFailure";

  constructor(
    message: string,
    readonly companyId: string | null,
  ) {
    super(message);
  }
}

/** L'app a-t-elle le droit de créer des clients et des entreprises ? (`null` : on ne sait pas.) */
export async function canCreatePros(admin: AdminApiContext): Promise<boolean | null> {
  const result = await runAdminGraphql<AccessData>(admin, ACCESS_QUERY);
  if (!result.ok) return null;
  return result.value.currentAppInstallation.accessScopes.some((scope) => scope.handle === PRO_WRITE_SCOPE);
}

function plainFailure(step: string, error: ShopifyGraphqlError, companyId: string | null): MakeProFailure {
  logError(`Compte pro : ${step}`, error, { companyId });
  if (/access denied|access scope/i.test(error.message)) {
    return new MakeProFailure(
      "L’app n’a pas encore le droit de créer des comptes pro dans Shopify. Il faut d’abord faire l’étape d’autorisation (cadre jaune en haut de la page).",
      companyId,
    );
  }
  const detail = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  const base = error instanceof ShopifyUserErrors ? "Shopify a refusé cette étape." : "Shopify ne répond pas pour le moment.";
  return new MakeProFailure(`${base} ${detail ?? "Réessayez dans un instant\u202F: rien ne sera créé deux fois."}`, companyId);
}

async function findCustomer(admin: AdminApiContext, email: string) {
  const result = await runAdminGraphql<CustomerByEmailData>(admin, CUSTOMER_BY_EMAIL_QUERY, { query: `email:"${email}"` });
  return result.ok ? success(pickCustomerWithEmail(result.value.customers.nodes, email)) : result;
}

async function readCompany(admin: AdminApiContext, id: string): Promise<Result<CompanyNode, ShopifyGraphqlError>> {
  const result = await runAdminGraphql<CompanyData>(admin, COMPANY_QUERY, { id });
  if (!result.ok) return result;
  return result.value.company === null ? failure(new ShopifyUserErrors([{ field: null, message: "Company not found" }])) : success(result.value.company);
}

export interface MakeProOptions {
  readonly existingCompanyId: string | null;
  readonly paymentTermsTemplateId: string | null;
  readonly onCompanyCreated: (companyId: string) => Promise<void>;
  /** false : aucun e-mail d'invitation (reprise des clients AbaNinja). Vrai par défaut. */
  readonly invite?: boolean;
  /** true : refuser, avant toute écriture, si un client a déjà cet e-mail (création d'une fiche AbaNinja absente). */
  readonly newCustomerOnly?: boolean;
}

export async function makePro(
  admin: AdminApiContext,
  input: ProAccountInput,
  options: MakeProOptions,
): Promise<Result<MakeProSuccess, MakeProFailure>> {
  const found = await findCustomer(admin, input.email);
  if (!found.ok) return failure(plainFailure("recherche du client", found.error, options.existingCompanyId));
  const customer = found.value;
  if (customer !== null && options.newCustomerOnly === true) {
    return failure(new MakeProFailure("Un client de la boutique a déjà cet e-mail. Rechargez la page pour le voir, puis reliez la fiche.", null));
  }

  // Déjà rattachée à une entreprise : on s'assure seulement de l'étiquette « pro ».
  const profile = customer?.companyContactProfiles[0];
  if (customer && profile && options.existingCompanyId === null) {
    const tagged = await runAdminMutation(admin, TAGS_ADD_MUTATION, (data: { tagsAdd: UserErrorList | null }) => data.tagsAdd, {
      id: customer.id,
      tags: [PRO_TAG],
    });
    if (!tagged.ok) return failure(plainFailure("étiquette pro", tagged.error, profile.company.id));
    return success({ companyId: profile.company.id, customerId: customer.id, alreadyPro: true, invited: false });
  }

  let companyId = options.existingCompanyId;
  if (companyId === null) {
    const created = await runAdminMutation(
      admin,
      COMPANY_CREATE_MUTATION,
      (data: { companyCreate: (UserErrorList & { company: { id: string } | null }) | null }) => data.companyCreate,
      { input: companyInput(input, options.paymentTermsTemplateId, customer === null) },
    );
    if (!created.ok || created.value.company === null) {
      return failure(plainFailure("création de l'entreprise", created.ok ? new ShopifyUserErrors([]) : created.error, null));
    }
    companyId = created.value.company.id;
    await options.onCompanyCreated(companyId);
    logInfo("Entreprise pro créée", { companyId });
  }

  const company = await readCompany(admin, companyId);
  if (!company.ok) return failure(plainFailure("lecture de l'entreprise", company.error, companyId));
  const location = company.value.locations.nodes[0];
  if (location === undefined) return failure(new MakeProFailure("L’entreprise n’a pas d’établissement dans Shopify. Ouvrez-la dans Shopify pour en ajouter un.", companyId));

  let contact = company.value.contacts.nodes.find(
    (node) => node.customer?.defaultEmailAddress?.emailAddress.toLowerCase() === input.email || (customer !== null && node.customer?.id === customer.id),
  );
  if (contact === undefined && customer !== null) {
    const assigned = await runAdminMutation(
      admin,
      ASSIGN_CUSTOMER_MUTATION,
      (data: { companyAssignCustomerAsContact: (UserErrorList & { companyContact: { id: string } | null }) | null }) =>
        data.companyAssignCustomerAsContact,
      { companyId, customerId: customer.id },
    );
    if (!assigned.ok || assigned.value.companyContact === null) {
      return failure(plainFailure("rattachement du client", assigned.ok ? new ShopifyUserErrors([]) : assigned.error, companyId));
    }
    contact = { id: assigned.value.companyContact.id, customer: { id: customer.id, defaultEmailAddress: null }, roleAssignments: { nodes: [] } };
  }
  const customerId = contact?.customer?.id;
  if (contact === undefined || customerId === undefined) {
    return failure(new MakeProFailure("La personne n’a pas pu être rattachée à l’entreprise. Ouvrez l’entreprise dans Shopify pour l’ajouter.", companyId));
  }

  if (!contact.roleAssignments.nodes.some((assignment) => assignment.companyLocation.id === location.id)) {
    const roles = company.value.contactRoles.nodes;
    const role = roles.find((candidate) => ORDER_ONLY_ROLE.test(candidate.name)) ?? roles[0];
    if (role !== undefined) {
      const assigned = await runAdminMutation(admin, ASSIGN_ROLE_MUTATION, (data: { companyContactAssignRole: UserErrorList | null }) => data.companyContactAssignRole, {
        companyContactId: contact.id,
        companyContactRoleId: role.id,
        companyLocationId: location.id,
      });
      if (!assigned.ok) return failure(plainFailure("rôle sur l'établissement", assigned.error, companyId));
    }
  }

  const tagged = await runAdminMutation(admin, TAGS_ADD_MUTATION, (data: { tagsAdd: UserErrorList | null }) => data.tagsAdd, {
    id: customerId,
    tags: [PRO_TAG],
  });
  if (!tagged.ok) return failure(plainFailure("étiquette pro", tagged.error, companyId));

  if (options.invite === false) return success({ companyId, customerId, alreadyPro: false, invited: false });

  // L'invitation est un plus : son échec n'annule pas le compte pro.
  const invitation = await runAdminMutation(
    admin,
    WELCOME_EMAIL_MUTATION,
    (data: { companyContactSendWelcomeEmail: UserErrorList | null }) => data.companyContactSendWelcomeEmail,
    { companyContactId: contact.id },
  );
  if (!invitation.ok) logError("Compte pro : e-mail d'invitation non envoyé", invitation.error, { companyId });

  return success({ companyId, customerId, alreadyPro: false, invited: invitation.ok });
}
