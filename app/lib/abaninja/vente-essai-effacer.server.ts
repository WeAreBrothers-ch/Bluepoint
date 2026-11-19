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

function clientHint(row: AbaNinjaInvoice): string {
  return `le client « … essai BluePoint ${row.reference.slice(-15)} (à supprimer) »`;
}

function withoutInvoice(row: AbaNinjaInvoice, now: Date): RowOutcome {
  if (row.state === "refusee") return { kind: "effacee", text: `${row.orderName} : rien n’avait été créé dans AbaNinja.` };
  if (row.state === "en_cours" && now.getTime() - row.updatedAt.getTime() < STALE_MS) {
    return { kind: "gardee", text: `${row.orderName} : la facture est encore en train d’être faite. Réessayez dans deux minutes.` };
  }
  return {
    kind: "a_la_main",
    text: `${row.orderName} : cherchez dans AbaNinja une facture de référence ${row.reference} et ${clientHint(row)}, et supprimez-les s’ils existent.`,
  };
}

async function removeClient(config: AbaNinjaConfig, row: AbaNinjaInvoice, companyUuid: string | null, done: string): Promise<RowOutcome> {
  if (companyUuid !== null && (await deleteCompany(config, companyUuid)).ok) {
    return { kind: "effacee", text: `${row.orderName} : ${done} et client d’essai effacés.` };
  }
  return { kind: "a_la_main", text: `${row.orderName} : ${done}, mais ${clientHint(row)} reste dans AbaNinja : supprimez-le à la main.` };
}

async function eraseInAbaNinja(config: AbaNinjaConfig, row: AbaNinjaInvoice, now: Date): Promise<RowOutcome> {
  if (row.invoiceUuid === null) return withoutInvoice(row, now);
  const label = `facture ${saleLabel(row)}`;
  const read = await getInvoice(config, row.invoiceUuid);
  if (!read.ok) {
    if (read.error.code === "introuvable") return { kind: "a_la_main", text: `${row.orderName} : la ${label} n’est plus dans AbaNinja. Supprimez ${clientHint(row)} s’il reste.` };
    return { kind: "gardee", text: `${row.orderName} : AbaNinja n’a pas répondu. Réessayez dans un instant.` };
  }
  if (read.value.reference !== row.reference) {
    return { kind: "gardee", text: `${row.orderName} : la facture trouvée dans AbaNinja ne porte pas la référence de l’essai ; l’app n’y touche pas.` };
  }
  const status = interpretInvoiceStatus(read.value, todayInZurich(now));
  if (status === "annulee") return removeClient(config, row, read.value.companyUuid, `${label} déjà annulée`);
  // Supprimée à la main dans AbaNinja : il ne reste que le client d'essai et la copie de l'app.
  if (isGoneDocument(read.value)) return removeClient(config, row, read.value.companyUuid, `${label} déjà supprimée`);
  if (status !== "brouillon") {
    return { kind: "a_la_main", text: `${row.orderName} : la ${label} n’est plus un brouillon dans AbaNinja, l’app ne l’efface pas. Annulez-la dans AbaNinja.` };
  }
  if (!(await deleteInvoice(config, row.invoiceUuid)).ok) {
    return { kind: "gardee", text: `${row.orderName} : AbaNinja n’a pas effacé la ${label}. Réessayez dans un instant.` };
  }
  return removeClient(config, row, read.value.companyUuid, label);
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

async function eraseRow(config: AbaNinjaConfig, row: AbaNinjaInvoice, now: Date): Promise<RowOutcome> {
  const outcome = await eraseInAbaNinja(config, row, now);
  if (outcome.kind === "gardee") return outcome;
  try {
    await forget(row);
    return outcome;
  } catch (error) {
    logError("Facture d’essai effacée dans AbaNinja mais pas dans l’app", error, { orderId: row.orderId });
    return { kind: "gardee", text: `${outcome.text} L’app n’a pas pu oublier cet essai : réessayez.` };
  }
}

/** Factures d'essai faites directement par « J'ai livré » (sans bon de livraison). */
export async function eraseTestInvoices(config: AbaNinjaConfig, shop: string, now: Date = new Date()): Promise<RowOutcome[]> {
  const rows = await findTestSaleRows(shop);
  const outcomes: RowOutcome[] = [];
  // Une par une : AbaNinja n'aime pas les rafales, et l'ordre du rapport suit la liste.
  for (const row of rows) outcomes.push(await eraseRow(config, row, now));
  return outcomes;
}
