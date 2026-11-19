import { logError } from "../core/logger.server";
import { readAbaNinjaConfig } from "./config.server";
import { frenchTypography } from "./trial-typography";
import { eraseTestSaleNotes } from "./vente-bon-effacer.server";
import { eraseProTestClient } from "./vente-client-pro-effacer.server";
import { findProClient } from "./vente-client-pro-repository.server";
import { testPiecesRemain } from "./vente-essai-liste.server";
import { eraseTestInvoices } from "./vente-essai-effacer.server";
import { summarize, type RowOutcome } from "./vente-essai-resume";
import type { TestSalesEraseOutcome } from "./vente-essai-types";

/**
 * Bouton « Effacer les factures d'essai » de la page Connexion AbaNinja : factures directes, puis bons et leurs
 * factures, puis le client pro fictif, une seule fois, quand plus aucune pièce d'essai ne s'en sert.
 */

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
  // Sans savoir quel client est le client pro fictif, chaque pièce risquerait de l'emporter : rien n'est effacé.
  const shared = await findProClient(shop);
  if (!shared.ok) {
    logError("Client pro fictif illisible avant l’effacement", shared.error, { shop });
    return stop("L’app n’a pas pu lire le client pro fictif : rien n’est effacé. Réessayez dans un instant.", 503);
  }
  try {
    const sharedCompanyUuid = shared.value?.companyUuid ?? null;
    const pieces: RowOutcome[] = [
      ...(await eraseTestInvoices(config.value, shop, sharedCompanyUuid, now)),
      ...(await eraseTestSaleNotes(config.value, shop, sharedCompanyUuid, now)),
    ];
    // Relu juste avant : un essai arrivé pendant l'effacement, ou au-delà des 50 lus, s'en sert peut-être encore.
    const othersErased = pieces.every((piece) => piece.kind === "effacee") && !(await testPiecesRemain(shop));
    const client = await eraseProTestClient(config.value, shared.value, othersErased, now);
    return { result: typeset(summarize(client === null ? pieces : [...pieces, client])), status: 200 };
  } catch (error) {
    logError("Factures d’essai AbaNinja : effacement interrompu", error, { shop });
    return stop(UNEXPECTED, 500);
  }
}
