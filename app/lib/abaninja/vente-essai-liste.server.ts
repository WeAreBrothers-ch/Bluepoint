import prisma from "../../db.server";
import { logError } from "../core/logger.server";
import type { AbaNinjaInvoice } from "./repository-types";
import { findProClient, type AbaNinjaTestClient } from "./vente-client-pro-repository.server";
import { saleSummaryLabel } from "./vente-essai-resume";
import type { TestSaleSummary, TestSales } from "./vente-essai-types";
import { SALE_TEST_PREFIX } from "./vente-plan";
import { listTestSales } from "./vente-repository.server";

/**
 * Lignes du verrou qui appartiennent aux essais (factures directes de « J'ai livré », bons des commandes fictives) ;
 * jamais les vraies, jamais l'essai à 1 CHF. Le client pro fictif est montré en dernier : même resté seul, il s'efface.
 */

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

const PRO_CLIENT_LABELS: Readonly<Record<string, string>> = {
  cree: "dans AbaNinja, repris par chaque essai d’un pro",
  incertain: "à vérifier dans AbaNinja",
};

function proClientSummary(client: AbaNinjaTestClient): TestSaleSummary {
  return { orderName: "Client pro fictif", label: PRO_CLIENT_LABELS[client.state] ?? "en cours de création" };
}

interface Dated {
  readonly createdAt: Date;
  readonly summary: TestSaleSummary;
}

export async function loadTestSales(shop: string): Promise<TestSales> {
  try {
    const [invoices, notes, proClient] = await Promise.all([findTestSaleRows(shop), listTestSales(shop), findProClient(shop)]);
    if (!notes.ok) throw notes.error;
    if (!proClient.ok) throw proClient.error;
    const dated: Dated[] = [
      ...invoices.map((row) => ({ createdAt: row.createdAt, summary: summaryOf(row) })),
      ...notes.value.map((sale) => ({ createdAt: sale.createdAt, summary: { orderName: sale.orderName, label: saleSummaryLabel(sale) } })),
    ];
    const items = dated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((item) => item.summary);
    return { available: true, items: proClient.value === null ? items : [...items, proClientSummary(proClient.value)] };
  } catch (error) {
    logError("Essais AbaNinja illisibles", error, { shop });
    return { available: false, items: [] };
  }
}

/** Reste-t-il un essai noté par l'app (même au-delà des 50 lus) ? Vrai dans le doute : le client pro fictif ne part pas à l'aveugle. */
export async function testPiecesRemain(shop: string): Promise<boolean> {
  try {
    const [invoices, notes] = await Promise.all([findTestSaleRows(shop), listTestSales(shop)]);
    if (!notes.ok) throw notes.error;
    return invoices.length > 0 || notes.value.length > 0;
  } catch (error) {
    logError("Essais AbaNinja illisibles avant d’effacer le client pro fictif", error, { shop });
    return true;
  }
}
