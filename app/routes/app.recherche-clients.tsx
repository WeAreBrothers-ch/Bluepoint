import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { customerSearchQuery } from "../lib/commande/customers";
import { searchCustomers } from "../lib/commande/reads.server";
import type { CustomerOption } from "../lib/commande/types";
import { logError } from "../lib/core/logger.server";

/**
 * Recherche de clients pour la commande par téléphone (appelée par un fetcher, sans page).
 * ?q=texte → nom, entreprise, téléphone ou e-mail.
 */

export interface CustomerSearchResult {
  readonly term: string;
  readonly customers: readonly CustomerOption[];
  readonly error: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<CustomerSearchResult> => {
  const { admin, session } = await authenticate.admin(request);
  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const term = customerSearchQuery(raw);
  if (term === null) return { term: raw, customers: [], error: null };
  const result = await searchCustomers(admin, term);
  if (result.ok) return { term: raw, customers: result.value, error: null };
  logError("Recherche de clients impossible", result.error, { shop: session.shop });
  return { term: raw, customers: [], error: "La recherche de clients ne répond pas. Réessayez." };
};
