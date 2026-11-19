import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaInvoice } from "./repository-types";
import { saleSummaryLabel } from "./vente-essai-resume";
import type { TestSaleSummary, TestSales } from "./vente-essai-types";
import { SALE_TEST_PREFIX } from "./vente-plan";
import { listTestSales } from "./vente-repository.server";

/** Lignes du verrou qui appartiennent aux essais (factures directes de « J'ai livré », bons des commandes fictives) ; jamais les vraies, jamais l'essai à 1 CHF. */

const LIMIT = 50;

export function findTestSaleRows(shop: string): Promise<AbaNinjaInvoice[]> {
  return prisma.abaNinjaInvoice.findMany({
    where: { shop, isTest: true, reference: { startsWith: SALE_TEST_PREFIX } },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });
}

/** Numéro AbaNinja, ou la référence d'essai quand AbaNinja n'a pas donné de numéro au brouillon. */
export function saleLabel(row: Pick<AbaNinjaInvoice, "systemInvoiceNumber" | "reference">): string {
  return row.systemInvoiceNumber === null || row.systemInvoiceNumber === "" ? row.reference : row.systemInvoiceNumber;
}

function summaryOf(row: AbaNinjaInvoice): TestSaleSummary {
  const label =
    row.state === "creee"
      ? `facture ${saleLabel(row)}, brouillon dans AbaNinja`
      : row.state === "refusee"
        ? "refusée par AbaNinja, rien n’a été créé"
        : row.state === "incertaine"
          ? "à vérifier dans AbaNinja"
          : "en cours";
  return { orderName: row.orderName, label };
}

interface Dated {
  readonly createdAt: Date;
  readonly summary: TestSaleSummary;
}

export async function loadTestSales(shop: string): Promise<TestSales> {
  try {
    const [invoices, notes] = await Promise.all([findTestSaleRows(shop), listTestSales(shop)]);
    if (!notes.ok) throw notes.error;
    const dated: Dated[] = [
      ...invoices.map((row) => ({ createdAt: row.createdAt, summary: summaryOf(row) })),
      ...notes.value.map((sale) => ({ createdAt: sale.createdAt, summary: { orderName: sale.orderName, label: saleSummaryLabel(sale) } })),
    ];
    return { available: true, items: dated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((item) => item.summary) };
  } catch (error) {
    logError("Essais AbaNinja illisibles", error, { shop });
    return { available: false, items: [] };
  }
}
