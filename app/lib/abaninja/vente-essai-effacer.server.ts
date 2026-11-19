import type { Prisma } from "@prisma/client";
import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaConfig } from "./config.server";
import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { interpretInvoiceStatus, isGoneDocument, todayInZurich } from "./invoice-status";
import { getInvoice } from "./invoices.server";
import type { AbaNinjaInvoice } from "./repository-types";
import { findTestSaleRows, saleLabel } from "./vente-essai-liste.server";
import { STALE_MS, type RowOutcome } from "./vente-essai-resume";

/**
 * « Effacer les factures d'essai » : retire de AbaNinja chaque facture d'essai encore en brouillon et son
 * client d'essai, puis la copie gardée dans l'app. Ne touche jamais une facture dont la référence n'est pas
 * celle de l'essai, ni une facture qui n'est plus un brouillon.
 */

/** Une facture d'essai à effacer, et le client pro fictif gardé par l'app (null s'il n'y en a pas). */
interface Target {
  readonly row: AbaNinjaInvoice;
  readonly sharedCompanyUuid: string | null;
}

/** Ce qui a été fait de la facture, dit avec le client d'essai effacé ou seul. */
interface Done {
  readonly withClient: string;
  readonly alone: string;
}

function clientHint(row: AbaNinjaInvoice): string {
  return `le client « … essai BluePoint ${row.reference.slice(-15)} (à supprimer) »`;
}

/** Le client de la facture n'est pas connu : il est peut-être le client pro fictif, que l'app efface elle-même. */
function sharedHint(target: Target): string {
  return target.sharedCompanyUuid === null ? "" : " Ne supprimez pas le « Client pro fictif » : l’app s’en charge.";
}

function withoutInvoice(target: Target, now: Date): RowOutcome {
  const { row } = target;
  if (row.state === "refusee") return { kind: "effacee", text: `${row.orderName} : rien n’avait été créé dans AbaNinja.` };
  if (row.state === "en_cours" && now.getTime() - row.updatedAt.getTime() < STALE_MS) {
    return { kind: "gardee", text: `${row.orderName} : la facture est encore en train d’être faite. Réessayez dans deux minutes.` };
  }
  return {
    kind: "a_la_main",
    text: `${row.orderName} : cherchez dans AbaNinja une facture de référence ${row.reference} et ${clientHint(row)}, et supprimez-les s’ils existent.${sharedHint(target)}`,
  };
}

/** La facture partie, son client d'essai aussi ; le client pro fictif, lui, reste pour la fin (il sert aux autres essais). */
async function removeClient(config: AbaNinjaConfig, target: Target, companyUuid: string | null, done: Done): Promise<RowOutcome> {
  const { row, sharedCompanyUuid } = target;
  if (companyUuid !== null && companyUuid === sharedCompanyUuid) return { kind: "effacee", text: `${row.orderName} : ${done.alone}.` };
  if (companyUuid !== null && (await deleteCompany(config, companyUuid)).ok) {
    return { kind: "effacee", text: `${row.orderName} : ${done.withClient} et client d’essai effacés.` };
  }
  return { kind: "a_la_main", text: `${row.orderName} : ${done.withClient}, mais ${clientHint(row)} reste dans AbaNinja : supprimez-le à la main.` };
}

async function eraseInAbaNinja(config: AbaNinjaConfig, target: Target, now: Date): Promise<RowOutcome> {
  const { row } = target;
  if (row.invoiceUuid === null) return withoutInvoice(target, now);
  const label = `facture ${saleLabel(row)}`;
  const read = await getInvoice(config, row.invoiceUuid);
  if (!read.ok) {
    if (read.error.code === "introuvable") {
      return { kind: "a_la_main", text: `${row.orderName} : la ${label} n’est plus dans AbaNinja. Supprimez ${clientHint(row)} s’il reste.${sharedHint(target)}` };
    }
    return { kind: "gardee", text: `${row.orderName} : AbaNinja n’a pas répondu. Réessayez dans un instant.` };
  }
  if (read.value.reference !== row.reference) {
    return { kind: "gardee", text: `${row.orderName} : la facture trouvée dans AbaNinja ne porte pas la référence de l’essai ; l’app n’y touche pas.` };
  }
  const status = interpretInvoiceStatus(read.value, todayInZurich(now));
  const already = (what: string): Done => ({ withClient: `${label} ${what}`, alone: `${label} ${what}` });
  if (status === "annulee") return removeClient(config, target, read.value.companyUuid, already("déjà annulée"));
  // Supprimée à la main dans AbaNinja : il ne reste que le client d'essai et la copie de l'app.
  if (isGoneDocument(read.value)) return removeClient(config, target, read.value.companyUuid, already("déjà supprimée"));
  if (status !== "brouillon") {
    return { kind: "a_la_main", text: `${row.orderName} : la ${label} n’est plus un brouillon dans AbaNinja, l’app ne l’efface pas. Annulez-la dans AbaNinja.` };
  }
  if (!(await deleteInvoice(config, row.invoiceUuid)).ok) {
    return { kind: "gardee", text: `${row.orderName} : AbaNinja n’a pas effacé la ${label}. Réessayez dans un instant.` };
  }
  return removeClient(config, target, read.value.companyUuid, { withClient: label, alone: `${label} effacée` });
}

/** Retire la copie de l'app d'une facture d'essai et son PDF, seulement si son numéro est celui de l'essai. */
export async function removeTestCopy(tx: Prisma.TransactionClient, row: { readonly shop: string; readonly orderId: string }, numbers: readonly (string | null)[]): Promise<void> {
  const known = numbers.filter((number): number is string => number !== null && number !== "");
  const copy = await tx.invoice.findFirst({ where: { shop: row.shop, orderId: row.orderId, number: { in: known } } });
  if (copy === null) return;
  await tx.invoice.delete({ where: { id: copy.id } });
  await tx.storedFile.deleteMany({ where: { key: copy.pdfKey } });
}

/** Retire la copie de l'app et la ligne du verrou. */
async function forget(row: AbaNinjaInvoice): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await removeTestCopy(tx, row, [row.systemInvoiceNumber, row.reference]);
    await tx.abaNinjaInvoice.deleteMany({ where: { id: row.id } });
  });
}

async function eraseRow(config: AbaNinjaConfig, target: Target, now: Date): Promise<RowOutcome> {
  const { row } = target;
  const outcome = await eraseInAbaNinja(config, target, now);
  if (outcome.kind === "gardee") return outcome;
  try {
    await forget(row);
    return outcome;
  } catch (error) {
    logError("Facture d’essai effacée dans AbaNinja mais pas dans l’app", error, { orderId: row.orderId });
    return { kind: "gardee", text: `${outcome.text} L’app n’a pas pu oublier cet essai : réessayez.` };
  }
}

/**
 * Factures d'essai faites directement par « J'ai livré » (sans bon de livraison). `sharedCompanyUuid` : le client
 * pro fictif gardé par l'app (null s'il n'y en a pas), laissé pour la fin.
 */
export async function eraseTestInvoices(config: AbaNinjaConfig, shop: string, sharedCompanyUuid: string | null, now: Date = new Date()): Promise<RowOutcome[]> {
  const rows = await findTestSaleRows(shop);
  const outcomes: RowOutcome[] = [];
  // Une par une : AbaNinja n'aime pas les rafales, et l'ordre du rapport suit la liste.
  for (const row of rows) outcomes.push(await eraseRow(config, { row, sharedCompanyUuid }, now));
  return outcomes;
}
