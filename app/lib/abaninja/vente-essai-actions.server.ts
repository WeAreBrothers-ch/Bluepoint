import { logError } from "../core/logger.server";
import { readAbaNinjaConfig } from "./config.server";
import { frenchTypography } from "./trial-typography";
import { eraseTestSaleNotes } from "./vente-bon-effacer.server";
import { eraseTestInvoices } from "./vente-essai-effacer.server";
import { summarize } from "./vente-essai-resume";
import type { TestSalesEraseOutcome } from "./vente-essai-types";

/** Bouton « Effacer les factures d'essai » de la page Connexion AbaNinja : factures directes, puis bons et leurs factures. */

export interface TestSalesActionOutcome {
  readonly result: TestSalesEraseOutcome;
  readonly status: number;
}

const UNEXPECTED = "Un problème inattendu a interrompu l’effacement. Regardez dans AbaNinja ce qui reste (référence BP-ESSAI-FACT-… ou BP-ESSAI-CMD-…) avant de réessayer.";

function typeset(outcome: TestSalesEraseOutcome): TestSalesEraseOutcome {
  return { ...outcome, heading: frenchTypography(outcome.heading), details: outcome.details.map(frenchTypography) };
}

function stop(heading: string, status: number): TestSalesActionOutcome {
  return { result: typeset({ tone: "critical", heading, details: [] }), status };
}

export async function runEraseTestSales(shop: string, now: Date = new Date()): Promise<TestSalesActionOutcome> {
  const config = readAbaNinjaConfig();
  if (!config.ok) return stop(config.error.message, 409);
  try {
    const invoices = await eraseTestInvoices(config.value, shop, now);
    const notes = await eraseTestSaleNotes(config.value, shop, now);
    return { result: typeset(summarize([...invoices, ...notes])), status: 200 };
  } catch (error) {
    logError("Factures d’essai AbaNinja : effacement interrompu", error, { shop });
    return stop(UNEXPECTED, 500);
  }
}
