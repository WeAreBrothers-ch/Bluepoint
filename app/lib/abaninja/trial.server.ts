import { logError } from "../core/logger.server";
import { failure, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import { runCleanup } from "./trial-cleanup-step.server";
import { createTrialDocuments, type CreatedDocuments } from "./trial-create.server";
import { firstFailureHeadline, finishTrial } from "./trial-finish.server";
import { trialReference } from "./trial-fixtures";
import { ensureTrialAllowed } from "./trial-guard.server";
import { TRIAL_DEADLINE_MS } from "./trial-policy";
import { claimTrialSlot, trialOrderId } from "./trial-repository.server";
import { checkBankAccount, checkConfiguration } from "./trial-setup.server";
import { TrialBlockedError, TrialError, TrialLog, type TrialContext, type TrialReport } from "./trial-types";
import { checkInvoicePdf, checkInvoiceStatus } from "./trial-verify.server";

/**
 * Essai de connexion AbaNinja : prouve que tout marche avec une facture fictive de 1 CHF,
 * puis l'efface. Le circuit officiel des factures n'est pas touché, et aucun e-mail n'est
 * jamais envoyé (ni markSent, ni email) : la facture reste un brouillon.
 */

export interface TrialOptions {
  /** Garde la facture d'essai pour la regarder dans AbaNinja (saute le nettoyage). */
  readonly keepInvoice?: boolean;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly now?: () => Date;
  readonly call?: CallOptions;
  /** Échéance globale de l'essai ; 50 secondes par défaut, partagée par tous les appels. */
  readonly signal?: AbortSignal;
}

export type TrialResult = Result<TrialReport, TrialError | TrialBlockedError>;

const DATABASE_PROBLEM = "La base de l’application n’a pas répondu. Réessayez dans quelques instants.";
const ALREADY_STARTED = "Un essai a déjà démarré dans cette minute. Attendez une minute avant d’en lancer un autre.";

function stopped(log: TrialLog, reference?: string): TrialResult {
  const headline = firstFailureHeadline(log);
  return failure(new TrialError(log.report({ ok: false, headline, ...(reference === undefined ? {} : { reference }) })));
}

/** Garde-fou : un essai à la fois, un par minute, aucun essai précédent resté en suspens. */
async function guardError(shop: string, now: Date): Promise<TrialBlockedError | null> {
  const allowed = await ensureTrialAllowed(shop, now);
  if (allowed.ok) return null;
  if (allowed.error instanceof TrialBlockedError) return allowed.error;
  logError("Essai AbaNinja : dernier essai illisible", allowed.error, { shop });
  return new TrialBlockedError(DATABASE_PROBLEM);
}

async function claimError(ctx: TrialContext, log: TrialLog): Promise<TrialBlockedError | null> {
  const claim = await claimTrialSlot(ctx.shop, ctx.reference, ctx.now);
  if (!claim.ok) {
    logError("Essai AbaNinja : verrou impossible", claim.error, { shop: ctx.shop });
    return new TrialBlockedError(DATABASE_PROBLEM);
  }
  if (!claim.value.claimed) return new TrialBlockedError(ALREADY_STARTED);
  log.ok("verrou", "La protection contre les doublons est posée.");
  return null;
}

/** Étapes 5 et 6, seulement si la facture est bien créée et notée. */
async function verify(ctx: TrialContext, log: TrialLog, created: CreatedDocuments): Promise<void> {
  if (created.invoiceUuid === null || log.outcomeOf("creation") !== "ok") return;
  if (await checkInvoiceStatus(ctx, log, created.invoiceUuid)) await checkInvoicePdf(ctx, log, created.invoiceUuid);
}

export async function runConnectionTrial(shop: string, options: TrialOptions = {}): Promise<TrialResult> {
  const now = (options.now ?? (() => new Date()))();
  const call: CallOptions = { ...options.call, signal: options.signal ?? AbortSignal.timeout(TRIAL_DEADLINE_MS) };
  const log = new TrialLog();
  const blocked = await guardError(shop, now);
  if (blocked !== null) return failure(blocked);
  const config = checkConfiguration(log, options.env ?? process.env);
  if (config === null) return stopped(log);
  const bankAccountUuid = await checkBankAccount(log, config, call);
  if (bankAccountUuid === null) return stopped(log);
  const reference = trialReference(now);
  const ctx: TrialContext = { shop, orderId: trialOrderId(shop, now), reference, now, config, call };
  const refused = await claimError(ctx, log);
  if (refused !== null) return failure(refused);
  const created = await createTrialDocuments(ctx, log, bankAccountUuid);
  await verify(ctx, log, created);
  const keep = options.keepInvoice === true;
  return finishTrial(ctx, log, created, keep, await runCleanup(ctx, log, created, keep));
}
