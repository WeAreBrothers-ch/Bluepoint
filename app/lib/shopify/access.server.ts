import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { runAdminGraphql } from "./graphql.server";

/**
 * Autorisations accordées à l'app dans la boutique. Une nouvelle autorisation n'existe qu'une fois
 * acceptée dans Shopify (« Mettre à jour ») : les pages concernées l'expliquent au lieu d'échouer.
 */

const ACCESS_QUERY = `#graphql
query AutorisationsAccordees { currentAppInstallation { accessScopes { handle } } }`;

interface AccessData {
  readonly currentAppInstallation: { readonly accessScopes: readonly { readonly handle: string }[] };
}

/** `null` si Shopify n'a pas répondu. */
export async function grantedScopes(admin: AdminApiContext): Promise<ReadonlySet<string> | null> {
  const result = await runAdminGraphql<AccessData>(admin, ACCESS_QUERY);
  if (!result.ok) return null;
  return new Set(result.value.currentAppInstallation.accessScopes.map((scope) => scope.handle));
}
