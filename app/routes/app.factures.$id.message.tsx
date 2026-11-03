import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { loadInvoiceDrafts, type InvoiceDraftsResult } from "../lib/factures/draft.server";

/**
 * Objet et messages proposés pour envoyer une facture (appelé par un fetcher, sans page).
 * /app/factures/<identifiant de la facture>/message
 */

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<InvoiceDraftsResult> => {
  const { admin, session } = await authenticate.admin(request);
  const invoiceId = params["id"] ?? "";
  if (!/^[a-z0-9]{1,64}$/i.test(invoiceId)) return { ok: false, message: "Facture introuvable." };
  return loadInvoiceDrafts(admin, session.shop, invoiceId, new Date());
};
