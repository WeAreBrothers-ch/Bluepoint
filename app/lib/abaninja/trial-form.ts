import { z } from "zod";

/**
 * Ce que les formulaires de la page peuvent envoyer. Chaque action demande un champ de confirmation
 * explicite : sans lui, le serveur refuse (la page ne suffit pas à elle seule).
 *  - lancer l'essai : confirmation « oui », case « garder » facultative ;
 *  - débloquer un essai incertain : confirmation « absente » + la référence que la personne a lue.
 */

const REFERENCE_PATTERN = /^BP-ESSAI-\d{8}-\d{6}$/;

const startSchema = z.strictObject({
  intent: z.literal("essai"),
  confirmation: z.literal("oui"),
  garder: z.literal("on").optional(),
});

const resolveSchema = z.strictObject({
  intent: z.literal("debloquer"),
  confirmation: z.literal("absente"),
  reference: z.string().regex(REFERENCE_PATTERN),
});

const formSchema = z.discriminatedUnion("intent", [startSchema, resolveSchema]);

export type TrialFormResult =
  | { readonly kind: "essai"; readonly keepInvoice: boolean }
  | { readonly kind: "debloquer"; readonly reference: string }
  | { readonly kind: "refuse" };

export function parseTrialForm(formData: FormData): TrialFormResult {
  const parsed = formSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { kind: "refuse" };
  if (parsed.data.intent === "essai") return { kind: "essai", keepInvoice: parsed.data.garder === "on" };
  return { kind: "debloquer", reference: parsed.data.reference };
}
