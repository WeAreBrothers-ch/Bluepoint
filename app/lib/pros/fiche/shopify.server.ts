import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../../core/result";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../../shopify/errors";
import { runAdminGraphql, runAdminMutation, type MutationPayload } from "../../shopify/graphql.server";
import { CUSTOMER_UPDATE_MUTATION, FICHE_QUERY, LOCATION_ADDRESS_MUTATION, LOCATION_PHONE_MUTATION, type FicheCustomerData } from "./documents";
import type { FichePlan } from "./plan";
import { ficheStateFrom, type FicheState } from "./state";

/**
 * Lecture et écriture de la fiche pro dans Shopify. Les écritures partent dans l'ordre : la personne d'abord, car
 * Shopify peut refuser son téléphone (déjà pris par un autre client) ; dans ce cas rien d'autre n'est écrit.
 * Chaque écriture ne remplit que du vide : renvoyer le formulaire une deuxième fois ne change rien.
 */

export function customerGid(numeric: string): string {
  return `gid://shopify/Customer/${numeric}`;
}

/** `null` : le client n'existe pas ou n'est rattaché à aucune entreprise. */
export async function readFiche(admin: AdminApiContext, customerId: string, lieu: string | null): Promise<Result<FicheState | null, ShopifyGraphqlError>> {
  const result = await runAdminGraphql<FicheCustomerData>(admin, FICHE_QUERY, { id: customerId });
  return result.ok ? success(ficheStateFrom(result.value, lieu)) : result;
}

export class FicheWriteFailure extends Error {
  override readonly name = "FicheWriteFailure";

  constructor(
    /** `phone_taken` : un autre client de la boutique a déjà ce numéro (Shopify exige un numéro par client). */
    readonly reason: "phone_taken" | "refused",
    options?: { cause?: unknown },
  ) {
    super(reason === "phone_taken" ? "Téléphone déjà pris par un autre client" : "Fiche pro refusée par Shopify", options);
  }
}

function isPhoneTaken(error: ShopifyGraphqlError): boolean {
  return error instanceof ShopifyUserErrors && error.userErrors.some((userError) => userError.field?.includes("phone") === true && /taken/i.test(userError.message));
}

type Pick<TData> = (data: TData) => MutationPayload | null | undefined;

async function mutate<TData>(admin: AdminApiContext, mutation: string, pick: Pick<TData>, variables: Readonly<Record<string, unknown>>) {
  const result = await runAdminMutation(admin, mutation, pick, variables);
  return result.ok ? success(undefined) : failure(new FicheWriteFailure(isPhoneTaken(result.error) ? "phone_taken" : "refused", { cause: result.error }));
}

export async function writeFiche(admin: AdminApiContext, locationId: string, plan: FichePlan): Promise<Result<void, FicheWriteFailure>> {
  if (plan.customer !== null) {
    const written = await mutate(admin, CUSTOMER_UPDATE_MUTATION, (data: { customerUpdate: MutationPayload | null }) => data.customerUpdate, { input: plan.customer });
    if (!written.ok) return written;
  }
  if (plan.locationPhone !== null) {
    const written = await mutate(admin, LOCATION_PHONE_MUTATION, (data: { companyLocationUpdate: MutationPayload | null }) => data.companyLocationUpdate, {
      companyLocationId: locationId,
      input: { phone: plan.locationPhone },
    });
    if (!written.ok) return written;
  }
  if (plan.address !== null) {
    const written = await mutate(admin, LOCATION_ADDRESS_MUTATION, (data: { companyLocationAssignAddress: MutationPayload | null }) => data.companyLocationAssignAddress, {
      locationId,
      address: plan.address.address,
      addressTypes: plan.address.addressTypes,
    });
    if (!written.ok) return written;
  }
  return success(undefined);
}
