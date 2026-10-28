import type { LoaderFunctionArgs } from "react-router";
import { logError } from "../lib/core/logger.server";
import { checkShareToken } from "../lib/factures/links.server";
import { pdfResponse, textResponse } from "../lib/factures/pdf-response.server";
import { getInvoiceById, readInvoicePdf } from "../lib/factures/repository.server";
import { invoiceFileName } from "../lib/factures/send.server";

/**
 * Lien public envoyé au client (WhatsApp) : PDF sans connexion, protégé par une signature
 * HMAC et valable 14 jours. Aucune autre donnée n'est accessible par cette route.
 */
export const loader = async ({ params }: LoaderFunctionArgs): Promise<Response> => {
  const check = checkShareToken(params.token ?? "");
  if (!check.ok) {
    return check.reason === "expire"
      ? textResponse(410, "Ce lien a expiré. Demandez un nouveau lien à Blue Point Distribution.")
      : textResponse(404, "Lien invalide.");
  }
  try {
    const invoice = await getInvoiceById(check.invoiceId);
    const pdf = invoice === null ? null : await readInvoicePdf(invoice.pdfKey);
    if (invoice === null || pdf === null) return textResponse(404, "Facture introuvable.");
    return pdfResponse(pdf, invoiceFileName(invoice), "inline");
  } catch (error) {
    logError("Lecture du PDF partagé impossible", error, { invoiceId: check.invoiceId });
    return textResponse(500, "Le PDF n’a pas pu être lu. Réessayez plus tard.");
  }
};
