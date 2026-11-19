import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaConfig } from "./config.server";
import { deleteDeliveryNote, getDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { interpretInvoiceStatus, isGoneDocument, todayInZurich } from "./invoice-status";
import { getInvoice } from "./invoices.server";
import { removeTestCopy } from "./vente-essai-effacer.server";
import { STALE_MS, type RowOutcome } from "./vente-essai-resume";
import { listTestSales, type AbaNinjaSale } from "./vente-repository.server";

/**
 * « Effacer les factures d'essai », côté commandes fictives : pour chaque essai, la facture née du bon (seulement
 * en brouillon et à la référence de l'essai), puis le bon, puis le client d'essai, puis la copie et la ligne de
 * l'app. S'arrête dès qu'une pièce ne peut pas être effacée sans risque, et dit quoi faire à la main.
 */

/** null : cette pièce n'est plus dans AbaNinja, on passe à la suivante ; sinon on s'arrête là. */
type Step = RowOutcome | null;

/** Statuts d'un bon qui n'est plus là (un bon annulé, lui, existe encore et s'efface). */
const ERASED_NOTE = new Set(["deleted", "archived"]);

function keep(sale: AbaNinjaSale, text: string): RowOutcome {
  return { kind: "gardee", text: `${sale.orderName} : ${text}` };
}

function byHand(sale: AbaNinjaSale, text: string): RowOutcome {
  return { kind: "a_la_main", text: `${sale.orderName} : ${text}` };
}

function clientHint(sale: AbaNinjaSale): string {
  return `le client « … essai BluePoint ${sale.reference.slice(-15)} (à supprimer) »`;
}

function noteName(sale: AbaNinjaSale): string {
  const number = sale.noteNumber === null ? "" : ` ${sale.noteNumber}`;
  return `le bon${number} (référence ${sale.reference})`;
}

function stillRunning(sale: AbaNinjaSale, now: Date): boolean {
  return now.getTime() - sale.updatedAt.getTime() < STALE_MS;
}

function passing(error: AbaNinjaError): boolean {
  return error.code === "indisponible" || error.code === "trop_de_requetes";
}

async function eraseInvoice(config: AbaNinjaConfig, sale: AbaNinjaSale, now: Date): Promise<Step> {
  if (sale.invoiceUuid === null) {
    if (sale.invoiceState === null) return null;
    if (sale.invoiceState === "en_cours" && stillRunning(sale, now)) return keep(sale, "la facture est encore en train d’être faite. Réessayez dans deux minutes.");
    return byHand(sale, `cherchez dans AbaNinja une facture de référence ${sale.reference}, ${noteName(sale)} et ${clientHint(sale)}, et supprimez-les s’ils existent.`);
  }
  const label = `facture ${sale.invoiceNumber ?? sale.reference}`;
  const read = await getInvoice(config, sale.invoiceUuid);
  if (!read.ok) return read.error.code === "introuvable" ? null : keep(sale, "AbaNinja n’a pas répondu. Réessayez dans un instant.");
  if (read.value.reference !== sale.reference) return keep(sale, "la facture trouvée dans AbaNinja ne porte pas la référence de l’essai ; l’app n’y touche pas.");
  const status = interpretInvoiceStatus(read.value, todayInZurich(now));
  if (status === "annulee" || isGoneDocument(read.value)) return null;
  if (status !== "brouillon") {
    return byHand(sale, `la ${label} n’est plus un brouillon dans AbaNinja : l’app ne l’efface pas, ni son bon ni son client. Annulez-la dans AbaNinja.`);
  }
  return (await deleteInvoice(config, sale.invoiceUuid)).ok ? null : keep(sale, `AbaNinja n’a pas effacé la ${label}. Réessayez dans un instant.`);
}

/**
 * Bon jamais confirmé par AbaNinja : le client d'essai noté est effacé (AbaNinja répond 409 s'il sert encore,
 * sans doute à ce bon), puis Eliott cherche le bon à la main.
 */
async function eraseUnconfirmedNote(config: AbaNinjaConfig, sale: AbaNinjaSale): Promise<RowOutcome> {
  const search = `cherchez dans AbaNinja un bon de livraison de référence ${sale.reference}`;
  const both = `${search} et ${clientHint(sale)}, et supprimez-les s’ils existent.`;
  if (sale.companyUuid === null) return byHand(sale, both);
  const removed = await deleteCompany(config, sale.companyUuid);
  if (removed.ok || removed.error.code === "introuvable") return byHand(sale, `${search} et supprimez-le s’il existe (le client d’essai est effacé).`);
  if (removed.error.status === 409) return byHand(sale, `${search} : ${clientHint(sale)} sert encore, sans doute à ce bon. Supprimez le bon, puis le client.`);
  return passing(removed.error) ? keep(sale, "AbaNinja n’a pas répondu. Réessayez dans un instant.") : byHand(sale, both);
}

async function eraseNote(config: AbaNinjaConfig, sale: AbaNinjaSale, now: Date): Promise<Step> {
  if (sale.noteUuid === null) {
    if (sale.noteState === "refuse") return null;
    if (sale.noteState === "en_cours" && stillRunning(sale, now)) return keep(sale, "le bon est encore en train d’être fait. Réessayez dans deux minutes.");
    return eraseUnconfirmedNote(config, sale);
  }
  const read = await getDeliveryNote(config, sale.noteUuid);
  if (!read.ok) return read.error.code === "introuvable" ? null : keep(sale, "AbaNinja n’a pas répondu. Réessayez dans un instant.");
  if (read.value.reference !== sale.reference) return keep(sale, "le bon trouvé dans AbaNinja ne porte pas la référence de l’essai ; l’app n’y touche pas.");
  if (ERASED_NOTE.has(read.value.status)) return null;
  const deleted = await deleteDeliveryNote(config, sale.noteUuid);
  if (deleted.ok) return null;
  if (passing(deleted.error)) return keep(sale, "AbaNinja n’a pas effacé le bon de livraison. Réessayez dans un instant.");
  return byHand(sale, `AbaNinja refuse d’effacer ${noteName(sale)} : supprimez-le à la main, puis ${clientHint(sale)}.`);
}

/** « bon, facture » ; null quand aucune pièce n'a été faite (bon refusé : seul le client d'essai a pu rester). */
function piecesOf(sale: AbaNinjaSale): string | null {
  const pieces = [sale.noteUuid === null ? null : "bon", sale.invoiceUuid === null ? null : "facture"].filter((piece) => piece !== null);
  return pieces.length === 0 ? null : pieces.join(", ");
}

async function eraseClient(config: AbaNinjaConfig, sale: AbaNinjaSale): Promise<RowOutcome> {
  const pieces = piecesOf(sale);
  if (sale.companyUuid === null) {
    return { kind: "effacee", text: `${sale.orderName} : ${pieces === null ? "rien n’avait été créé dans AbaNinja" : `${pieces} effacés`}.` };
  }
  const removed = await deleteCompany(config, sale.companyUuid);
  if (removed.ok || removed.error.code === "introuvable") {
    return { kind: "effacee", text: `${sale.orderName} : ${pieces === null ? "client d’essai effacé" : `${pieces} et client d’essai effacés`}.` };
  }
  const stillUsed = removed.error.status === 409 ? " (il sert encore à un document)" : "";
  const left = `${clientHint(sale)} reste dans AbaNinja${stillUsed} : supprimez-le à la main.`;
  return byHand(sale, pieces === null ? left : `${pieces} effacés, mais ${left}`);
}

async function eraseInAbaNinja(config: AbaNinjaConfig, sale: AbaNinjaSale, now: Date): Promise<RowOutcome> {
  return (await eraseInvoice(config, sale, now)) ?? (await eraseNote(config, sale, now)) ?? eraseClient(config, sale);
}

async function eraseSale(config: AbaNinjaConfig, sale: AbaNinjaSale, now: Date): Promise<RowOutcome> {
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

export async function eraseTestSaleNotes(config: AbaNinjaConfig, shop: string, now: Date = new Date()): Promise<RowOutcome[]> {
  const sales = await listTestSales(shop);
  if (!sales.ok) {
    logError("Bons d’essai AbaNinja illisibles", sales.error, { shop });
    return [{ kind: "gardee", text: "La liste des bons d’essai n’a pas pu être lue. Réessayez dans un instant." }];
  }
  const outcomes: RowOutcome[] = [];
  // Un par un : AbaNinja n'aime pas les rafales, et l'ordre du rapport suit la liste.
  for (const sale of sales.value) outcomes.push(await eraseSale(config, sale, now));
  return outcomes;
}
