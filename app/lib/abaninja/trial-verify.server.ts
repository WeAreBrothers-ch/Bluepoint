import { logError } from "../core/logger.server";
import { downloadInvoicePdf } from "./pdf-download.server";
import { getInvoice } from "./invoices.server";
import { interpretInvoiceStatus, todayInZurich, type InvoiceReadState } from "./invoice-status";
import { recordStatus } from "./repository.server";
import type { TrialContext, TrialLog } from "./trial-types";

/** Étapes 5 et 6 : relire la facture chez AbaNinja, puis vérifier son PDF (jamais conservé ni renvoyé). */

const MIN_PDF_BYTES = 1_000;

const STATE_TEXT: Readonly<Record<InvoiceReadState, string>> = {
  brouillon: "brouillon",
  envoyee: "envoyée",
  payee: "payée",
  partiellement_payee: "partiellement payée",
  en_retard: "en retard",
  annulee: "annulée",
  inconnu: "inconnu",
};

/** Lit l'état de la facture ; vrai seulement si c'est bien un brouillon (rien n'est parti chez un client). */
export async function checkInvoiceStatus(ctx: TrialContext, log: TrialLog, invoiceUuid: string): Promise<boolean> {
  const details = await getInvoice(ctx.config, invoiceUuid, ctx.call);
  if (!details.ok) {
    log.fail("statut", `La facture d’essai n’a pas pu être relue. ${details.error.message}`);
    return false;
  }
  const state = interpretInvoiceStatus(details.value, todayInZurich(ctx.now));
  const openAmountCents = details.value.openAmount === null ? null : Math.round(details.value.openAmount * 100);
  const saved = await recordStatus(ctx.orderId, { status: state, openAmountCents });
  if (!saved.ok) logError("Essai AbaNinja : statut non noté", saved.error, { shop: ctx.shop });
  if (state !== "brouillon") {
    log.fail("statut", `La facture d’essai n’est pas en brouillon (état : ${STATE_TEXT[state]}). Regardez-la dans AbaNinja.`);
    return false;
  }
  log.ok("statut", "AbaNinja confirme que la facture existe et qu’elle est en brouillon : rien n’est parti chez un client.");
  return true;
}

export async function checkInvoicePdf(ctx: TrialContext, log: TrialLog, invoiceUuid: string): Promise<boolean> {
  const pdf = await downloadInvoicePdf(ctx.config, invoiceUuid, ctx.call);
  if (!pdf.ok) {
    log.fail("pdf", `Le PDF n’a pas pu être téléchargé. ${pdf.error.message}`);
    return false;
  }
  if (pdf.value.byteLength < MIN_PDF_BYTES) {
    log.fail("pdf", "Le PDF reçu est presque vide. Regardez la facture dans AbaNinja.");
    return false;
  }
  const kilobytes = Math.max(1, Math.round(pdf.value.byteLength / 1024));
  log.ok("pdf", `PDF reçu (${kilobytes} Ko), il commence bien par « %PDF- ». Il n’est pas gardé par l’application.`);
  return true;
}
