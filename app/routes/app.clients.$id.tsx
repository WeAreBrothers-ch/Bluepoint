import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ClientPageView } from "../components/clients/ClientPageView";
import { loadClientPage, type ClientPageData } from "../lib/clients/detail.server";
import { updateClient } from "../lib/clients/edit.server";
import { logError } from "../lib/core/logger.server";
import { parseNewCustomer, readNewCustomerForm, type NewCustomerErrors, type NewCustomerValues } from "../lib/commande/new-customer";

/** Fiche d'un client : coordonnées, modification, dernières commandes. */

export type ClientEditResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string; readonly errors: NewCustomerErrors; readonly values: NewCustomerValues };

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<ClientPageData & { readonly numericId: string }> => {
  const { admin, session } = await authenticate.admin(request);
  const numericId = params.id ?? "";
  return { ...(await loadClientPage(admin, session.shop, numericId, new Date())), numericId };
};

export const action = async ({ request, params }: ActionFunctionArgs): Promise<ClientEditResult> => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const values = readNewCustomerForm(form);
  const parsed = parseNewCustomer(values);
  if (!parsed.ok) return { ok: false, message: "Certaines cases sont à corriger (en rouge).", errors: parsed.errors, values };
  const rawAddressId = form.get("addressId");
  const addressId = typeof rawAddressId === "string" && rawAddressId !== "" ? rawAddressId : null;
  try {
    const updated = await updateClient(admin, params.id ?? "", addressId, parsed.value);
    return updated.ok ? { ok: true, message: "C’est enregistré." } : { ok: false, message: updated.error.message, errors: {}, values };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Modification du client impossible", error);
    return { ok: false, message: "Ça n’a pas marché. Réessayez dans un instant.", errors: {}, values };
  }
};

export default function ClientPage() {
  const { numericId, ...data } = useLoaderData<typeof loader>();
  return <ClientPageView data={data} numericId={numericId} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
