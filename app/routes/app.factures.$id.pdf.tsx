import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logError } from "../lib/core/logger.server";
import { pdfResponse, textResponse } from "../lib/factures/pdf-response.server";
import { getShopInvoice, readInvoicePdf } from "../lib/factures/repository.server";
import { invoiceFileName } from "../lib/factures/send.server";

/** PDF d'une facture, réservé à l'équipe connectée à l'admin (jeton de session requis). */
export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<Response> => {
  const { session } = await authenticate.admin(request);
  const id = params.id ?? "";
  try {
    const invoice = await getShopInvoice(session.shop, id);
    const pdf = invoice === null ? null : await readInvoicePdf(invoice.pdfKey);
    if (invoice === null || pdf === null) return textResponse(404, "Facture introuvable.");
    return pdfResponse(pdf, invoiceFileName(invoice), "attachment");
  } catch (error) {
    logError("Lecture du PDF impossible", error, { invoiceId: id });
    return textResponse(500, "Le PDF n’a pas pu être lu. Réessayez.");
  }
};
