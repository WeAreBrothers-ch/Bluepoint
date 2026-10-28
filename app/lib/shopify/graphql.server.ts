import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import {
  ShopifyRequestError,
  ShopifyUserErrors,
  type ShopifyGraphqlError,
  type ShopifyUserError,
} from "./errors";

/**
 * Helpers typés pour l'Admin GraphQL API (version fixée dans shopify.server.ts).
 * Toutes les requêtes de l'app passent par ici : une erreur Shopify devient un
 * `Result` en échec au lieu d'un crash, sauf les redirections d'authentification
 * (objets Response lancés par la librairie) qui doivent remonter telles quelles.
 */

export type GraphqlVariables = Readonly<Record<string, unknown>>;

interface GraphqlBody<TData> {
  readonly data?: TData;
  readonly errors?: unknown;
}

function isAuthRedirect(thrown: unknown): thrown is Response {
  return thrown instanceof Response;
}

function describeErrors(errors: unknown): string {
  return typeof errors === "string" ? errors : JSON.stringify(errors);
}

/** Exécute une requête ou une mutation et renvoie ses données typées. */
export async function runAdminGraphql<TData>(
  admin: AdminApiContext,
  query: string,
  variables?: GraphqlVariables,
): Promise<Result<TData, ShopifyRequestError>> {
  try {
    const response = await admin.graphql(query, { variables: { ...variables } });
    const body = (await response.json()) as GraphqlBody<TData>;
    if (body.errors !== undefined || body.data === undefined) {
      return failure(new ShopifyRequestError(`Réponse GraphQL invalide : ${describeErrors(body.errors)}`));
    }
    return success(body.data);
  } catch (thrown) {
    if (isAuthRedirect(thrown)) throw thrown;
    return failure(new ShopifyRequestError("Échec de la requête Shopify", { cause: thrown }));
  }
}

/** Forme commune des réponses de mutation : un résultat et des `userErrors`. */
export interface MutationPayload {
  readonly userErrors: readonly ShopifyUserError[];
}

/**
 * Exécute une mutation et convertit les `userErrors` en échec.
 * `pick` extrait le payload de la mutation depuis `data`.
 */
export async function runAdminMutation<TData, TPayload extends MutationPayload>(
  admin: AdminApiContext,
  mutation: string,
  pick: (data: TData) => TPayload | null | undefined,
  variables?: GraphqlVariables,
): Promise<Result<TPayload, ShopifyGraphqlError>> {
  const result = await runAdminGraphql<TData>(admin, mutation, variables);
  if (!result.ok) return result;
  const payload = pick(result.value);
  if (!payload) return failure(new ShopifyRequestError("Mutation sans résultat"));
  if (payload.userErrors.length > 0) return failure(new ShopifyUserErrors(payload.userErrors));
  return success(payload);
}
