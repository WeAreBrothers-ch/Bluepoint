import { logError } from "../core/logger.server";
import { readAbaNinjaConfig } from "./config.server";
import { frenchTypography } from "./trial-typography";
import { eraseTestSales } from "./vente-essai-effacer.server";
import type { TestSalesEraseOutcome } from "./vente-essai-types";

/** Bouton « Effacer les factures d'essai » de la page Connexion AbaNinja. */

export interface TestSalesActionOutcome {
  readonly result: TestSalesEraseOutcome;
  readonly status: number;
}

const UNEXPECTED = "Un problème inattendu a interrompu l’effacement. Regardez dans AbaNinja ce qui reste (référence BP-ESSAI-FACT-…) avant de réessayer.";

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
    return { result: typeset(await eraseTestSales(config.value, shop, now)), status: 200 };
  } catch (error) {
    logError("Factures d’essai AbaNinja : effacement interrompu", error, { shop });
    return stop(UNEXPECTED, 500);
  }
}
