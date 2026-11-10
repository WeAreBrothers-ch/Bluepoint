/**
 * Rapport de l'essai de connexion AbaNinja. Tout ce qui est ici peut partir
 * vers le navigateur : des textes simples, jamais de jeton ni la moindre partie de l'identifiant de compte.
 */

import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { CleanupIssueCode } from "./repository-types";
import type { ResolveAvailability } from "./trial-policy";
import { frenchTypography } from "./trial-typography";

export const TRIAL_STEP_KEYS = ["configuration", "comptes", "verrou", "creation", "statut", "pdf", "nettoyage"] as const;
export type TrialStepKey = (typeof TRIAL_STEP_KEYS)[number];
export type TrialStepOutcome = "ok" | "echec" | "non_teste";

export interface TrialStep {
  readonly key: TrialStepKey;
  readonly label: string;
  readonly outcome: TrialStepOutcome;
  /** Explication en français simple : ce qui s'est passé et, en cas d'échec, quoi faire. */
  readonly message: string;
}

export interface TrialReport {
  /** true quand les étapes 1 à 6 ont réussi (le nettoyage est jugé à part). */
  readonly ok: boolean;
  readonly headline: string;
  readonly steps: readonly TrialStep[];
  readonly reference: string | null;
  readonly invoiceNumber: string | null;
  /** Ce que le propriétaire doit supprimer lui-même dans AbaNinja (vide si tout est propre). */
  readonly manualCleanup: readonly string[];
  readonly notes: readonly string[];
}

const LABELS: Readonly<Record<TrialStepKey, string>> = {
  configuration: "Les accès AbaNinja sont enregistrés",
  comptes: "Le compte bancaire de la QR-facture est prêt",
  verrou: "La protection contre les doublons est posée",
  creation: "Une facture fictive en brouillon est créée",
  statut: "AbaNinja confirme que la facture existe",
  pdf: "Le PDF de la facture se télécharge",
  nettoyage: "L’essai est effacé d’AbaNinja",
};

const NOT_TESTED = "Pas essayé : une étape avant a échoué.";

function polish(step: TrialStep): TrialStep {
  return { ...step, message: frenchTypography(step.message) };
}

/** Erreur d'essai : l'essai s'est arrêté, le rapport dit où et pourquoi. */
export class TrialError extends Error {
  constructor(readonly report: TrialReport) {
    super(report.headline);
    this.name = "TrialError";
  }
}

export interface ReportDetails {
  readonly ok: boolean;
  readonly headline: string;
  readonly reference?: string | null;
  readonly invoiceNumber?: string | null;
  readonly manualCleanup?: readonly string[];
  readonly notes?: readonly string[];
}

/** Carnet de bord de l'essai : les étapes non jouées sont complétées « non testé » à la fin. */
export class TrialLog {
  readonly #steps = new Map<TrialStepKey, TrialStep>();

  record(key: TrialStepKey, outcome: Exclude<TrialStepOutcome, "non_teste">, message: string): void {
    this.#steps.set(key, { key, label: LABELS[key], outcome, message });
  }

  ok(key: TrialStepKey, message: string): void {
    this.record(key, "ok", message);
  }

  fail(key: TrialStepKey, message: string): void {
    this.record(key, "echec", message);
  }

  skip(key: TrialStepKey, message: string): void {
    this.#steps.set(key, { key, label: LABELS[key], outcome: "non_teste", message });
  }

  outcomeOf(key: TrialStepKey): TrialStepOutcome {
    return this.#steps.get(key)?.outcome ?? "non_teste";
  }

  report(details: ReportDetails): TrialReport {
    const steps = TRIAL_STEP_KEYS.map(
      (key): TrialStep => this.#steps.get(key) ?? { key, label: LABELS[key], outcome: "non_teste", message: NOT_TESTED },
    );
    return {
      ok: details.ok,
      headline: frenchTypography(details.headline),
      steps: steps.map(polish),
      reference: details.reference ?? null,
      invoiceNumber: details.invoiceNumber ?? null,
      manualCleanup: (details.manualCleanup ?? []).map(frenchTypography),
      notes: (details.notes ?? []).map(frenchTypography),
    };
  }
}

/** Ce que partagent toutes les étapes d'un même essai. */
export interface TrialContext {
  readonly shop: string;
  readonly orderId: string;
  readonly reference: string;
  readonly now: Date;
  readonly config: AbaNinjaConfig;
  readonly call: CallOptions;
}

/** Essai refusé avant de commencer (garde-fou) : aucun rapport d'étapes, juste pourquoi et quand réessayer. */
export class TrialBlockedError extends Error {
  constructor(message: string) {
    super(frenchTypography(message));
    this.name = "TrialBlockedError";
  }
}

/** Réponse de la page : un rapport, un refus neutre, un déblocage fait, ou un message d'erreur simple. */
export type TrialActionResult =
  | { readonly kind: "rapport"; readonly report: TrialReport }
  | { readonly kind: "bloque"; readonly message: string }
  | { readonly kind: "debloque"; readonly message: string }
  | { readonly kind: "erreur"; readonly message: string };

/** État des accès AbaNinja côté serveur : jamais de valeur, seulement présent et valide / absent / invalide. */
export type ConfigStatus =
  | { readonly kind: "ok" }
  | { readonly kind: "absente" | "invalide"; readonly message: string };

/** Ce que la page sait sans appeler AbaNinja (voir trial-status.server.ts). */
export interface LastTrialSummary {
  /** Date au format ISO, mise en forme par la page. */
  readonly createdAt: string;
  readonly state: string;
  readonly reference: string;
  readonly invoiceNumber: string | null;
  /** Ce qu'il reste à supprimer à la main, ou null. */
  readonly cleanupIssue: CleanupIssueCode | null;
  readonly resolve: ResolveAvailability;
}

export interface TrialPageStatus {
  readonly config: ConfigStatus;
  readonly lastTrial: LastTrialSummary | null;
  /** false si la base n'a pas pu être lue (on le dit au lieu de faire croire qu'il n'y a jamais eu d'essai). */
  readonly historyReadable: boolean;
}
