import type { AbaNinjaSale } from "@prisma/client";
import type { TestSalesEraseOutcome } from "./vente-essai-types";

/** Ce que la page Connexion AbaNinja dit des essais : la ligne de chaque essai, et le bilan de l'effacement. */

/** effacee : plus rien nulle part ; a_la_main : l'app oublie l'essai, Eliott vérifie dans AbaNinja ; gardee : à refaire plus tard. */
export type RowOutcome = { readonly kind: "effacee" | "a_la_main" | "gardee"; readonly text: string };

/** Une pièce « en cours » depuis moins longtemps que ça est sans doute encore en train de se faire. */
export const STALE_MS = 2 * 60_000;

export function summarize(outcomes: readonly RowOutcome[]): TestSalesEraseOutcome {
  const details = outcomes.map((outcome) => outcome.text);
  if (outcomes.length === 0) return { tone: "success", heading: "Aucun essai à effacer", details };
  if (outcomes.every((outcome) => outcome.kind === "effacee")) return { tone: "success", heading: "Factures d’essai effacées", details };
  if (outcomes.some((outcome) => outcome.kind === "gardee")) return { tone: "warning", heading: "Une partie n’a pas pu être effacée", details };
  return { tone: "warning", heading: "Effacé, avec des choses à vérifier dans AbaNinja", details };
}

function noteLabel(sale: AbaNinjaSale): string {
  const number = `bon n° ${sale.noteNumber ?? sale.reference}`;
  switch (sale.noteState) {
    case "cree":
      return number;
    case "converti":
      return `${number} réglé`;
    case "annule":
      return `${number} annulé`;
    case "refuse":
      return sale.companyUuid === null ? "bon refusé par AbaNinja, rien n’a été créé" : "bon refusé par AbaNinja, client d’essai resté";
    case "en_cours":
      return "bon en cours";
    default:
      return "bon à vérifier dans AbaNinja";
  }
}

function invoiceLabel(sale: AbaNinjaSale): string | null {
  if (sale.invoiceState === null) return null;
  if (sale.invoiceState === "en_cours") return "facture en cours";
  if (sale.invoiceState !== "creee") return "facture à vérifier dans AbaNinja";
  const payment = sale.paymentState === "inscrit" ? ", payée" : sale.paymentState === "incertain" ? ", paiement à vérifier" : "";
  return `facture ${sale.invoiceNumber ?? sale.reference}${payment}`;
}

/** « bon n° L00042 réglé · facture R02292, payée ». */
export function saleSummaryLabel(sale: AbaNinjaSale): string {
  return [noteLabel(sale), invoiceLabel(sale)].filter((part): part is string => part !== null).join(" · ");
}
