import { z } from "zod";
import { FactureError } from "./erreurs";
import { invoiceSchema, type InvoiceInput } from "./schema";

/** Messages zod génériques en français, sans toucher à la configuration globale de l'application. */
const MESSAGES_FR = z.locales.fr().localeError;

function chemin(issue: z.core.$ZodIssue): string {
  return issue.path.length === 0 ? "facture" : issue.path.map(String).join(".");
}

/**
 * Vérifie et normalise des données de facture d'origine inconnue (JSON, base de données, formulaire).
 * Lève une `FactureError` dont `details` liste chaque problème avec le champ concerné.
 */
export function validateInvoiceInput(raw: unknown): InvoiceInput {
  const resultat = invoiceSchema.safeParse(raw, { error: MESSAGES_FR });
  if (resultat.success) return resultat.data;
  const details = resultat.error.issues.map((issue) => `${chemin(issue)} : ${issue.message}`);
  throw new FactureError(`Facture invalide :\n- ${details.join("\n- ")}`, details);
}
