import { isNotFound, readTrialNote, statusWord } from "./bl-essai-note.server";
import { DELIVERY_NOTE_TRIAL_PREFIX, type DeliveryNoteTrialOutcome, type TrialDocuments } from "./bl-essai-types";
import type { AbaNinjaConfig } from "./config.server";
import { deleteDeliveryNote, getDeliveryNote } from "./delivery-notes.server";
import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { interpretInvoiceStatus, todayInZurich } from "./invoice-status";
import { getInvoice } from "./invoices.server";

/**
 * Étape 3 de l'essai : efface la facture, le bon, puis le client d'essai, dans cet ordre
 * (AbaNinja refuse d'effacer un client encore lié à un document). Chaque document est relu avant.
 */

/** AbaNinja ne documente pas l'effacement : ces statuts prouvent que le document a disparu. */
const GONE_STATUSES: ReadonlySet<string> = new Set(["archived", "deleted", "cancelled"]);

interface EraseLog {
  readonly done: string[];
  readonly manual: string[];
}

/** Note une étape réussie ; renvoie true pour « on peut continuer ». */
function erased(log: EraseLog, text: string): true {
  log.done.push(text);
  return true;
}

/** Note ce qu'Eliott doit faire lui-même ; renvoie false pour « on s'arrête là ». */
function byHand(log: EraseLog, text: string): false {
  log.manual.push(text);
  return false;
}

async function invoiceIsGone(config: AbaNinjaConfig, invoiceUuid: string): Promise<boolean> {
  const after = await getInvoice(config, invoiceUuid);
  if (!after.ok) return isNotFound(after.error);
  return GONE_STATUSES.has(after.value.status) || after.value.isCancelled === true;
}

async function eraseInvoice(config: AbaNinjaConfig, documents: TrialDocuments, invoiceUuid: string, now: Date, log: EraseLog): Promise<boolean> {
  const by = `issue du bon ${documents.reference}`;
  const before = await getInvoice(config, invoiceUuid);
  if (!before.ok) {
    if (isNotFound(before.error)) return erased(log, "La facture d’essai n’existait déjà plus.");
    return byHand(log, `La facture d’essai (${by}) n’a pas pu être relue : supprimez-la à la main dans « Factures ».`);
  }
  const invoice = before.value;
  if (invoice.reference?.startsWith(DELIVERY_NOTE_TRIAL_PREFIX) !== true) {
    return byHand(log, `La facture ne porte pas une référence d’essai : la page n’y touche pas. Si c’est bien celle ${by}, supprimez-la à la main.`);
  }
  if (interpretInvoiceStatus(invoice, todayInZurich(now)) !== "brouillon") {
    const number = invoice.systemInvoiceNumber === null ? "" : `, n° ${invoice.systemInvoiceNumber}`;
    return byHand(log, `La facture n’est plus en brouillon (« ${statusWord(invoice.status)} »${number}) : annulez-la à la main dans « Factures ».`);
  }
  const deleted = await deleteInvoice(config, invoiceUuid);
  if (deleted.ok && (await invoiceIsGone(config, invoiceUuid))) return erased(log, "Facture d’essai effacée.");
  return byHand(log, `L’effacement de la facture (${by}) n’est pas confirmé : vérifiez dans « Factures ». Elle est en brouillon, rien n’a été envoyé.`);
}

async function eraseNote(config: AbaNinjaConfig, documents: TrialDocuments, log: EraseLog): Promise<boolean> {
  const deleted = await deleteDeliveryNote(config, documents.noteUuid);
  const after = await getDeliveryNote(config, documents.noteUuid);
  const gone = after.ok ? GONE_STATUSES.has(after.value.status) : isNotFound(after.error);
  if (gone) return erased(log, "Bon de livraison d’essai effacé.");
  const why = deleted.ok ? "AbaNinja le montre encore" : "AbaNinja a refusé de l’effacer";
  return byHand(log, `Le bon ${documents.reference} reste dans AbaNinja (${why}) : supprimez-le à la main dans « Bulletins de livraison ».`);
}

async function eraseCompany(config: AbaNinjaConfig, companyUuid: string | null, log: EraseLog): Promise<void> {
  const manually = "supprimez à la main le client dont le nom contient « essai BluePoint ».";
  if (companyUuid === null) {
    byHand(log, `Le client d’essai n’a pas pu être retrouvé : ${manually}`);
    return;
  }
  const deleted = await deleteCompany(config, companyUuid);
  if (deleted.ok) erased(log, "Client d’essai effacé.");
  else if (isNotFound(deleted.error)) erased(log, "Le client d’essai n’existait déjà plus.");
  else byHand(log, `Le client d’essai reste dans AbaNinja${deleted.error.status === 409 ? " (encore lié à un document)" : ""} : ${manually}`);
}

export async function eraseTrialDocuments(
  config: AbaNinjaConfig,
  documents: TrialDocuments,
  now: Date,
): Promise<DeliveryNoteTrialOutcome> {
  const note = await readTrialNote(config, documents.noteUuid);
  if (!note.ok && note.error.reason !== "introuvable") {
    return { tone: "critical", heading: "Rien n’a été effacé", details: [note.error.message], documents };
  }
  const log: EraseLog = { done: [], manual: [] };
  const invoiceGone = documents.invoiceUuid === null || (await eraseInvoice(config, documents, documents.invoiceUuid, now, log));
  let noteGone = !note.ok;
  if (!note.ok) {
    erased(log, "Le bon d’essai n’existait déjà plus.");
    await eraseCompany(config, null, log);
  } else if (!invoiceGone) {
    byHand(log, "Le bon et le client d’essai sont gardés tant que la facture existe : réessayez une fois la facture supprimée.");
  } else {
    noteGone = await eraseNote(config, documents, log);
    if (noteGone) await eraseCompany(config, note.value.companyUuid, log);
  }
  const clean = log.manual.length === 0;
  return {
    tone: clean ? "success" : "warning",
    heading: clean ? "Tout est effacé d’AbaNinja" : "Effacement incomplet",
    details: [...log.done, ...log.manual],
    documents: noteGone ? null : { ...documents, invoiceUuid: invoiceGone ? null : documents.invoiceUuid },
  };
}
