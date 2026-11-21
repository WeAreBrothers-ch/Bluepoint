import type { ClientsAbaNinjaResult } from "./actions.server";
import type { ComparisonView } from "./view";

/** Où la page « Clients AbaNinja » montre le résultat d'un bouton, et le libellé « voir plus ». Logique pure. */

export const PAGE_STEP = 20;

function cardHasItsOwnPlace(view: ComparisonView, fiche: string): boolean {
  const { groups } = view;
  return [groups.meme_email, groups.a_verifier, groups.absent, groups.ignore].some((rows) => rows.some((row) => row.card.uuid === fiche));
}

function batchButtonShown(view: ComparisonView, intent: "relier_tous" | "creer_tous"): boolean {
  return intent === "relier_tous" ? view.counts.meme_email > 1 : view.creatable > 1;
}

/** Le résultat à afficher en haut de la page : celui qui n'a plus de place à l'endroit du bouton touché. */
export function pageLevelResult(result: ClientsAbaNinjaResult | undefined, view: ComparisonView): ClientsAbaNinjaResult | undefined {
  if (result === undefined) return undefined;
  if (result.intent === "relier_tous" || result.intent === "creer_tous") return batchButtonShown(view, result.intent) ? undefined : result;
  if (result.fiche === null) return result;
  return cardHasItsOwnPlace(view, result.fiche) ? undefined : result;
}

/** « Voir 20 fiches de plus (encore 45) », « Voir 1 fiche de plus ». */
export function moreCardsLabel(rest: number): string {
  const next = Math.min(rest, PAGE_STEP);
  const label = `Voir ${next} fiche${next > 1 ? "s" : ""} de plus`;
  return rest > PAGE_STEP ? `${label} (encore ${rest})` : label;
}
