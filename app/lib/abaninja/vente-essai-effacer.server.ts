import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaConfig } from "./config.server";
import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { interpretInvoiceStatus, todayInZurich } from "./invoice-status";
import { getInvoice } from "./invoices.server";
import type { AbaNinjaInvoice } from "./repository-types";
import { findTestSaleRows, saleLabel } from "./vente-essai-liste.server";
import type { TestSalesEraseOutcome } from "./vente-essai-types";

/**
 * « Effacer les factures d'essai » : retire de AbaNinja chaque facture d'essai encore en brouillon et son
 * client d'essai, puis la copie gardée dans l'app. Ne touche jamais une facture dont la référence n'est pas
 * celle de l'essai, ni une facture qui n'est plus un brouillon.
 */

/** effacee : plus rien nulle part ; a_la_main : l'app oublie l'essai, Eliott vérifie dans AbaNinja ; gardee : à refaire plus tard. */
type RowOutcome = { readonly kind: "effacee" | "a_la_main" | "gardee"; readonly text: string };

const STALE_MS = 2 * 60_000;

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
  if (status !== "brouillon") {
    return { kind: "a_la_main", text: `${row.orderName} : la ${label} n’est plus un brouillon dans AbaNinja, l’app ne l’efface pas. Annulez-la dans AbaNinja.` };
  }
  if (!(await deleteInvoice(config, row.invoiceUuid)).ok) {
    return { kind: "gardee", text: `${row.orderName} : AbaNinja n’a pas effacé la ${label}. Réessayez dans un instant.` };
  }
  return removeClient(config, row, read.value.companyUuid, label);
}

/** Retire la copie de l'app (seulement si c'est bien celle de l'essai) et la ligne du verrou. */
async function forget(row: AbaNinjaInvoice): Promise<void> {
  const numbers = [row.systemInvoiceNumber ?? "", row.reference].filter((number) => number !== "");
  await prisma.$transaction(async (tx) => {
    const copy = await tx.invoice.findFirst({ where: { shop: row.shop, orderId: row.orderId, number: { in: numbers } } });
    if (copy !== null) {
      await tx.invoice.delete({ where: { id: copy.id } });
      await tx.storedFile.deleteMany({ where: { key: copy.pdfKey } });
    }
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

function summarize(outcomes: readonly RowOutcome[]): TestSalesEraseOutcome {
  const details = outcomes.map((outcome) => outcome.text);
  if (outcomes.every((outcome) => outcome.kind === "effacee")) return { tone: "success", heading: "Factures d’essai effacées", details };
  if (outcomes.some((outcome) => outcome.kind === "gardee")) return { tone: "warning", heading: "Une partie n’a pas pu être effacée", details };
  return { tone: "warning", heading: "Effacé, avec des choses à vérifier dans AbaNinja", details };
}

export async function eraseTestSales(config: AbaNinjaConfig, shop: string, now: Date = new Date()): Promise<TestSalesEraseOutcome> {
  const rows = await findTestSaleRows(shop);
  if (rows.length === 0) return { tone: "success", heading: "Aucune facture d’essai à effacer", details: [] };
  const outcomes: RowOutcome[] = [];
  // Une par une : AbaNinja n'aime pas les rafales, et l'ordre du rapport suit la liste.
  for (const row of rows) outcomes.push(await eraseRow(config, row, now));
  return summarize(outcomes);
}
