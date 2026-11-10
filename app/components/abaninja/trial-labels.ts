import type { CleanupIssueCode } from "../../lib/abaninja/repository-types";
import type { TrialStepOutcome } from "../../lib/abaninja/trial-types";
import { frenchTypography } from "../../lib/abaninja/trial-typography";

/** Mots affichés pour chaque résultat : un symbole ET un mot, pour ne pas dépendre de la couleur. */
export const OUTCOME_TEXT: Readonly<Record<TrialStepOutcome, string>> = {
  ok: "✓ Réussi",
  echec: "✕ Échec",
  non_teste: "– Pas essayé",
};

const STATE_TEXT: Readonly<Record<string, string>> = {
  en_cours: "pas terminé",
  creee: "terminé",
  incertaine: "résultat incertain",
  refusee: "arrêté, aucune facture créée (un client d’essai a pu l’être)",
};

export function stateText(state: string): string {
  return STATE_TEXT[state] ?? "état inconnu";
}

const ISSUE_TEXT: Readonly<Record<CleanupIssueCode, string>> = {
  nettoyage_incomplet: "Le nettoyage n’a pas abouti ou n’est pas confirmé.",
  gardee: "Vous avez choisi de garder la facture d’essai.",
  non_brouillon: "La facture n’est pas un brouillon : ne la supprimez pas vous-même, voyez avec votre comptable.",
};

export function issueText(code: CleanupIssueCode): string {
  return frenchTypography(ISSUE_TEXT[code]);
}
