import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaInvoice } from "./repository-types";
import type { TestSaleSummary, TestSales } from "./vente-essai-types";
import { SALE_TEST_PREFIX } from "./vente-plan";

/** Lignes du verrou qui appartiennent aux factures d'essai de « J'ai livré » (jamais les vraies, jamais l'essai à 1 CHF). */

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

export async function loadTestSales(shop: string): Promise<TestSales> {
  try {
    return { available: true, items: (await findTestSaleRows(shop)).map(summaryOf) };
  } catch (error) {
    logError("Factures d’essai AbaNinja illisibles", error, { shop });
    return { available: false, items: [] };
  }
}
