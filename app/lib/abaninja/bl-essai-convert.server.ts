import { logInfo } from "../core/logger.server";
import { chf, readTrialNote, statusWord } from "./bl-essai-note.server";
import type { DeliveryNoteTrialOutcome, TrialDocuments } from "./bl-essai-types";
import type { AbaNinjaConfig } from "./config.server";
import { convertDeliveryNoteToInvoice, getDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { classifyCreateFailure } from "./invoice-errors";
import { interpretInvoiceStatus, todayInZurich } from "./invoice-status";
import { getInvoice, type InvoiceDetails } from "./invoices.server";

/** Étape 2 de l'essai : le bon devient une facture, comme le jour de la livraison. Rien n'est envoyé. */

function kept(documents: TrialDocuments, tone: "critical" | "warning", heading: string, details: readonly string[]): DeliveryNoteTrialOutcome {
  return { tone, heading, details, documents };
}

function conversionFailed(documents: TrialDocuments, error: AbaNinjaError): DeliveryNoteTrialOutcome {
  logInfo("Essai bon de livraison : transformation refusée", { status: error.status ?? null, code: error.code });
  if (classifyCreateFailure(error) === "incertaine") {
    return kept(documents, "warning", "Le résultat est incertain", [
      error.message,
      `Regardez dans « Factures » si une facture issue du bon ${documents.reference} est apparue avant de réessayer. Rien n’a été envoyé à personne.`,
    ]);
  }
  return kept(documents, "warning", "AbaNinja a refusé de transformer le bon en facture", [
    `${error.message}${error.status === undefined ? "" : ` (code ${error.status})`}`,
    "Rien n’a été créé. C’est une information utile pour la suite : AbaNinja veut sans doute un bon finalisé avant d’en faire une facture. Le bon d’essai reste en brouillon ; vous pouvez tout effacer.",
  ]);
}

function invoiceLines(invoice: InvoiceDetails, noteReference: string | null, now: Date): string[] {
  const draft = interpretInvoiceStatus(invoice, todayInZurich(now)) === "brouillon";
  const lines = [
    `Statut dans AbaNinja : « ${statusWord(invoice.status)} »${invoice.systemInvoiceNumber === null ? ", sans numéro pour l’instant" : `, n° ${invoice.systemInvoiceNumber}`}.`,
  ];
  if (invoice.openAmount !== null) lines.push(`Montant à payer : ${chf(invoice.openAmount)}.`);
  lines.push(
    invoice.reference !== null && invoice.reference === noteReference
      ? "La facture garde la référence du bon : on retrouve facilement la commande."
      : `Référence de la facture : ${invoice.reference ?? "aucune"} (différente de celle du bon).`,
  );
  if (!draft) lines.push("Attention : la facture n’est pas en brouillon. Ne l’envoyez pas ; l’étape 3 dira quoi faire.");
  return lines;
}

export async function convertTrialDeliveryNote(
  config: AbaNinjaConfig,
  documents: TrialDocuments,
  now: Date,
): Promise<DeliveryNoteTrialOutcome> {
  if (documents.invoiceUuid !== null) return kept(documents, "warning", "Ce bon a déjà été transformé en facture", []);
  const note = await readTrialNote(config, documents.noteUuid);
  if (!note.ok) return kept(documents, "critical", "Le bon d’essai n’a pas pu être relu", [note.error.message]);
  const converted = await convertDeliveryNoteToInvoice(config, documents.noteUuid);
  if (!converted.ok) return conversionFailed(documents, converted.error);
  const next: TrialDocuments = { ...documents, invoiceUuid: converted.value };
  const [invoice, after] = await Promise.all([getInvoice(config, converted.value), getDeliveryNote(config, documents.noteUuid)]);
  logInfo("Essai bon de livraison : facture créée", {
    invoiceStatus: invoice.ok ? invoice.value.status : null,
    numbered: invoice.ok ? invoice.value.systemInvoiceNumber !== null : null,
    noteStatus: after.ok ? after.value.status : null,
  });
  const details = invoice.ok ? invoiceLines(invoice.value, note.value.reference, now) : ["La facture est créée, mais elle n’a pas pu être relue tout de suite."];
  if (after.ok) details.push(`Le bon de livraison est maintenant « ${statusWord(after.value.status)} ».`);
  details.push("Pour la voir : AbaNinja, menu « Factures ». Rien n’a été envoyé au client.");
  return { tone: "success", heading: "Le bon est devenu une facture dans AbaNinja", details, documents: next };
}
