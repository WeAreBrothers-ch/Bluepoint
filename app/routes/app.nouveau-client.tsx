import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logError } from "../lib/core/logger.server";
import { parseNewCustomer, readNewCustomerForm, type NewCustomerErrors, type NewCustomerValues } from "../lib/commande/new-customer";
import { createCustomer } from "../lib/commande/new-customer.server";
import type { CustomerOption } from "../lib/commande/types";

/** « Nouveau client » de « Prendre une commande » (appelé par un fetcher, sans page). */

export type NewCustomerResult =
  | { readonly ok: true; readonly customer: CustomerOption }
  | { readonly ok: false; readonly message: string; readonly errors: NewCustomerErrors; readonly values: NewCustomerValues };

export const action = async ({ request }: ActionFunctionArgs): Promise<NewCustomerResult> => {
  const { admin } = await authenticate.admin(request);
  const values = readNewCustomerForm(await request.formData());
  const parsed = parseNewCustomer(values);
  if (!parsed.ok) return { ok: false, message: "Certaines cases sont à corriger (en rouge).", errors: parsed.errors, values };
  try {
    const created = await createCustomer(admin, parsed.value);
    return created.ok ? { ok: true, customer: created.value } : { ok: false, message: created.error.message, errors: {}, values };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Nouveau client impossible", error);
    return { ok: false, message: "Ça n’a pas marché. Réessayez dans un instant.", errors: {}, values };
  }
};
