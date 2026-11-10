import { logError } from "../core/logger.server";
import { readAbaNinjaConfig } from "./config.server";
import { CLEANUP_ISSUE_CODES, type AbaNinjaInvoice, type CleanupIssueCode } from "./repository-types";
import { findLatestTrial } from "./trial-repository.server";
import { resolveAvailability } from "./trial-policy";
import type { ConfigStatus, LastTrialSummary, TrialPageStatus } from "./trial-types";

/**
 * Ce que la page « Connexion AbaNinja » sait sans appeler AbaNinja : l'état des accès
 * (présent et valide, absent ou invalide, jamais une valeur ni un morceau de valeur)
 * et le dernier essai connu.
 */

type Env = Readonly<Record<string, string | undefined>>;

function isSet(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

export function readConfigStatus(env: Env): ConfigStatus {
  const config = readAbaNinjaConfig(env);
  if (config.ok) return { kind: "ok" };
  const bothSet = isSet(env["ABANINJA_TOKEN"]) && isSet(env["ABANINJA_ACCOUNT_UUID"]);
  return { kind: bothSet ? "invalide" : "absente", message: config.error.message };
}

function issueOf(trial: AbaNinjaInvoice): CleanupIssueCode | null {
  if (trial.state === "incertaine" || trial.state === "en_cours") return null;
  return CLEANUP_ISSUE_CODES.find((code) => code === trial.lastErrorCode) ?? null;
}

function summarize(trial: AbaNinjaInvoice, now: Date): LastTrialSummary {
  return {
    createdAt: trial.createdAt.toISOString(),
    state: trial.state,
    reference: trial.reference,
    invoiceNumber: trial.systemInvoiceNumber === null || trial.systemInvoiceNumber === "" ? null : trial.systemInvoiceNumber,
    cleanupIssue: issueOf(trial),
    resolve: resolveAvailability(trial, now),
  };
}

export async function loadTrialPageStatus(
  shop: string,
  env: Env = process.env,
  now: Date = new Date(),
): Promise<TrialPageStatus> {
  const config = readConfigStatus(env);
  const latest = await findLatestTrial(shop);
  if (!latest.ok) {
    logError("Page AbaNinja : dernier essai illisible", latest.error, { shop });
    return { config, lastTrial: null, historyReadable: false };
  }
  return { config, lastTrial: latest.value === null ? null : summarize(latest.value, now), historyReadable: true };
}
