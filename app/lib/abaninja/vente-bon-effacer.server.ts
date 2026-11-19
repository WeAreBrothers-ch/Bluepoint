import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaConfig } from "./config.server";
import { deleteDeliveryNote, getDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { interpretInvoiceStatus, isGoneDocument, todayInZurich } from "./invoice-status";
import { getInvoice, type InvoiceDetails } from "./invoices.server";
import { removeTestCopy } from "./vente-essai-effacer.server";
import {
  byHand,
  clientHint,
  erased,
  erasedRow,
  invoiceByHand,
  keep,
  noteName,
  ownClientHint,
  piecesOf,
  type ErasingSale,
} from "./vente-bon-effacer-textes";
import { STALE_MS, type RowOutcome } from "./vente-essai-resume";
import { listTestSales, type AbaNinjaSale } from "./vente-repository.server";

/**
 * « Effacer les factures d'essai », côté commandes fictives : pour chaque essai, la facture née du bon (seulement
 * en brouillon et à la référence de l'essai), puis le bon, puis le client d'essai, puis la copie et la ligne de
 * l'app. S'arrête dès qu'une pièce ne peut pas être effacée sans risque, et dit quoi faire à la main. Le client
 * pro fictif n'est jamais effacé ici : il sert aux autres essais et part une seule fois, à la fin.
 */

/** null : cette pièce n'est plus dans AbaNinja, on passe à la suivante ; sinon on s'arrête là. */
type Step = RowOutcome | null;

/** Statuts d'un bon qui n'est plus là (un bon annulé, lui, existe encore et s'efface). */
const ERASED_NOTE = new Set(["deleted", "archived"]);

function stillRunning(sale: AbaNinjaSale, now: Date): boolean {
  return now.getTime() - sale.updatedAt.getTime() < STALE_MS;
}

function passing(error: AbaNinjaError): boolean {
  return error.code === "indisponible" || error.code === "trop_de_requetes";
}

/**
 * Ce que la facture lue dans AbaNinja empêche d'effacer ; null si c'est un brouillon de l'essai (à effacer)
 * ou une facture déjà annulée (on passe au bon). Une facture payée garde son paiement : il part d'abord, à la main.
 */
function invoiceBlock(sale: ErasingSale, invoice: InvoiceDetails, now: Date): Step | "brouillon" {
  const label = `la facture ${invoice.systemInvoiceNumber ?? sale.invoiceNumber ?? sale.reference}`;
  if (invoice.reference !== sale.reference) {
    return invoiceByHand(sale, `${label} trouvée dans AbaNinja ne porte pas la référence de l’essai (${sale.reference})`, "Vérifiez-la dans AbaNinja.");
  }
  const status = interpretInvoiceStatus(invoice, todayInZurich(now));
  if (status === "annulee" || isGoneDocument(invoice)) return null;
  if (status === "payee" || status === "partiellement_payee") {
    return invoiceByHand(sale, `${label} est payée dans AbaNinja`, "Supprimez d’abord son paiement dans AbaNinja, puis annulez la facture.");
  }
  return status === "brouillon" ? "brouillon" : invoiceByHand(sale, `${label} n’est plus un brouillon dans AbaNinja`, "Annulez-la dans AbaNinja.");
}

async function eraseInvoice(config: AbaNinjaConfig, sale: ErasingSale, now: Date): Promise<Step> {
  if (sale.invoiceUuid === null) {
    if (sale.invoiceState === null) return null;
    if (sale.invoiceState === "en_cours" && stillRunning(sale, now)) return keep(sale, "la facture est encore en train d’être faite. Réessayez dans deux minutes.");
    const client = clientHint(sale);
    const pieces = client === null ? `une facture de référence ${sale.reference} et ${noteName(sale)}` : `une facture de référence ${sale.reference}, ${noteName(sale)} et ${client}`;
    return byHand(sale, `cherchez dans AbaNinja ${pieces}, et supprimez-les s’ils existent.`);
  }
  const read = await getInvoice(config, sale.invoiceUuid);
  if (!read.ok) return read.error.code === "introuvable" ? null : keep(sale, "AbaNinja n’a pas répondu. Réessayez dans un instant.");
  const block = invoiceBlock(sale, read.value, now);
  if (block !== "brouillon") return block;
  const deleted = await deleteInvoice(config, sale.invoiceUuid);
  return deleted.ok ? null : keep(sale, `AbaNinja n’a pas effacé la facture ${sale.invoiceNumber ?? sale.reference}. Réessayez dans un instant.`);
}

/**
 * Bon jamais confirmé par AbaNinja : le client d'essai noté est effacé (AbaNinja répond 409 s'il sert encore,
 * sans doute à ce bon), puis Eliott cherche le bon à la main.
 */
async function eraseUnconfirmedNote(config: AbaNinjaConfig, sale: ErasingSale): Promise<RowOutcome> {
  const search = `cherchez dans AbaNinja un bon de livraison de référence ${sale.reference}`;
  const client = clientHint(sale);
  if (client === null) return byHand(sale, `${search} et supprimez-le s’il existe.`);
  const both = `${search} et ${client}, et supprimez-les s’ils existent.`;
  if (sale.companyUuid === null) return byHand(sale, both);
  const removed = await deleteCompany(config, sale.companyUuid);
  if (removed.ok || removed.error.code === "introuvable") return byHand(sale, `${search} et supprimez-le s’il existe (le client d’essai est effacé).`);
  if (removed.error.status === 409) return byHand(sale, `${search} : ${client} sert encore, sans doute à ce bon. Supprimez le bon, puis le client.`);
  return passing(removed.error) ? keep(sale, "AbaNinja n’a pas répondu. Réessayez dans un instant.") : byHand(sale, both);
}

async function eraseNote(config: AbaNinjaConfig, sale: ErasingSale, now: Date): Promise<Step> {
  if (sale.noteUuid === null) {
    if (sale.noteState === "refuse") return null;
    if (sale.noteState === "en_cours" && stillRunning(sale, now)) return keep(sale, "le bon est encore en train d’être fait. Réessayez dans deux minutes.");
    return eraseUnconfirmedNote(config, sale);
  }
  const read = await getDeliveryNote(config, sale.noteUuid);
  if (!read.ok) return read.error.code === "introuvable" ? null : keep(sale, "AbaNinja n’a pas répondu. Réessayez dans un instant.");
  if (read.value.reference !== sale.reference) {
    const found = sale.noteNumber === null ? "le bon" : `le bon ${sale.noteNumber}`;
    const client = clientHint(sale);
    const rest = client === null ? "l’app n’efface pas ce bon. Vérifiez-le dans AbaNinja." : `l’app n’efface ni ce bon ni ${client}. Vérifiez-le dans AbaNinja, puis supprimez à la main le client.`;
    return byHand(sale, `${found} trouvé dans AbaNinja ne porte pas la référence de l’essai (${sale.reference}) : ${rest}`);
  }
  if (ERASED_NOTE.has(read.value.status)) return null;
  const deleted = await deleteDeliveryNote(config, sale.noteUuid);
  if (deleted.ok) return null;
  if (passing(deleted.error)) return keep(sale, "AbaNinja n’a pas effacé le bon de livraison. Réessayez dans un instant.");
  const client = clientHint(sale);
  return byHand(sale, `AbaNinja refuse d’effacer ${noteName(sale)} : supprimez-le à la main${client === null ? "" : `, puis ${client}`}.`);
}

async function eraseClient(config: AbaNinjaConfig, sale: ErasingSale): Promise<RowOutcome> {
  const pieces = piecesOf(sale);
  if (sale.companyUuid === null || sale.sharedClient) return erasedRow(sale, pieces);
  const removed = await deleteCompany(config, sale.companyUuid);
  if (removed.ok || removed.error.code === "introuvable") return erasedRow(sale, [...pieces, "client d’essai"]);
  const done = erased(pieces);
  const before = done === null ? "" : `${done}, mais `;
  if (passing(removed.error)) return keep(sale, `${before}AbaNinja n’a pas répondu pour le client d’essai. Réessayez dans un instant.`);
  const stillUsed = removed.error.status === 409 ? " (il sert encore à un document)" : "";
  return byHand(sale, `${before}${ownClientHint(sale)} reste dans AbaNinja${stillUsed} : supprimez-le à la main.`);
}

async function eraseInAbaNinja(config: AbaNinjaConfig, sale: ErasingSale, now: Date): Promise<RowOutcome> {
  return (await eraseInvoice(config, sale, now)) ?? (await eraseNote(config, sale, now)) ?? eraseClient(config, sale);
}

async function eraseSale(config: AbaNinjaConfig, sale: ErasingSale, now: Date): Promise<RowOutcome> {
  const outcome = await eraseInAbaNinja(config, sale, now);
  if (outcome.kind === "gardee") return outcome;
  try {
    await prisma.$transaction(async (tx) => {
      await removeTestCopy(tx, sale, [sale.invoiceNumber, sale.reference]);
      await tx.abaNinjaSale.deleteMany({ where: { id: sale.id } });
    });
    return outcome;
  } catch (error) {
    logError("Essai effacé dans AbaNinja mais pas dans l’app", error, { orderId: sale.orderId });
    return { kind: "gardee", text: `${outcome.text} L’app n’a pas pu oublier cet essai : réessayez.` };
  }
}

/** `sharedCompanyUuid` : le client pro fictif gardé par l'app (null s'il n'y en a pas), laissé pour la fin. */
export async function eraseTestSaleNotes(config: AbaNinjaConfig, shop: string, sharedCompanyUuid: string | null, now: Date = new Date()): Promise<RowOutcome[]> {
  const sales = await listTestSales(shop);
  if (!sales.ok) {
    logError("Bons d’essai AbaNinja illisibles", sales.error, { shop });
    return [{ kind: "gardee", text: "La liste des bons d’essai n’a pas pu être lue. Réessayez dans un instant." }];
  }
  const outcomes: RowOutcome[] = [];
  // Un par un : AbaNinja n'aime pas les rafales, et l'ordre du rapport suit la liste.
  for (const sale of sales.value) {
    const sharedClient = sale.companyUuid !== null && sale.companyUuid === sharedCompanyUuid;
    outcomes.push(await eraseSale(config, { ...sale, sharedClient }, now));
  }
  return outcomes;
}
