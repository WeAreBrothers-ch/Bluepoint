import { z } from "zod";
import { isSwissIban, isSwissQrIban, normalizeIban, normalizeVatNumber } from "./identifiers";

/**
 * Réglages de la boutique : coordonnées du vendeur imprimées sur chaque facture.
 * Mêmes règles que le moteur de facture (`facture-qr`), avec des messages en français.
 */

export const DEFAULT_LEGAL_NAME = "Blue Point Distribution Sàrl";

const required = (max: number) =>
  z.string().trim().min(1, "Champ obligatoire.").max(max, `${max} caractères au plus.`);

const ibanField = z.string().transform(normalizeIban);

/** Case à cocher : absente du formulaire quand elle est décochée. */
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on" || value === "1" || value === "true");

export const settingsSchema = z.object({
  legalName: required(70),
  street: required(70),
  buildingNumber: required(16),
  postalCode: z.string().trim().regex(/^\d{4}$/, "Numéro postal suisse à 4 chiffres attendu (ex. 1095)."),
  city: required(35),
  country: z.string().trim().toUpperCase().regex(/^(CH|LI)$/, "Pays\u202F: CH ou LI.").default("CH"),
  vatNumber: z.string().transform((raw, ctx) => {
    const vat = normalizeVatNumber(raw);
    if (vat === null) {
      ctx.addIssue({ code: "custom", message: "Numéro TVA invalide (format CHE-123.456.789 TVA, chiffre de contrôle vérifié)." });
      return z.NEVER;
    }
    return vat;
  }),
  iban: ibanField
    .refine(isSwissIban, "IBAN suisse (CH) ou liechtensteinois (LI) invalide.")
    .refine((iban) => !isSwissQrIban(iban), "Cet IBAN est un QR-IBAN\u202F: le saisir dans le champ « QR-IBAN »."),
  qrIban: z
    .string()
    .transform(normalizeIban)
    .refine((iban) => iban === "" || isSwissQrIban(iban), "Ce compte n’est pas un QR-IBAN (identifiant bancaire 30000 à 31999).")
    .transform((iban) => (iban === "" ? null : iban))
    .default(""),
  paymentTermDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Nombre de jours entier attendu (ex. 30).")
    .transform(Number)
    .pipe(z.number().max(120, "120 jours au plus.")),
  email: z.string().trim().pipe(z.email("Adresse e-mail invalide.")),
  phone: required(30),
  autoInvoiceOnDelivery: checkbox,
  notifyCustomerOnDelivery: checkbox,
});

export type SettingsInput = z.input<typeof settingsSchema>;
export type ShopSettingsValues = z.output<typeof settingsSchema>;
export type SettingsField = keyof ShopSettingsValues;
export type SettingsFieldErrors = Partial<Record<SettingsField, string>>;

export type SettingsParseResult =
  | { readonly ok: true; readonly values: ShopSettingsValues }
  | { readonly ok: false; readonly errors: SettingsFieldErrors };

const FIELDS: readonly SettingsField[] = Object.keys(settingsSchema.shape) as SettingsField[];

function isField(value: PropertyKey | undefined): value is SettingsField {
  return typeof value === "string" && (FIELDS as readonly string[]).includes(value);
}

/** Valide des réglages d'origine inconnue (formulaire, base) ; une erreur par champ. */
export function parseSettings(raw: Readonly<Record<string, unknown>>): SettingsParseResult {
  const result = settingsSchema.safeParse(raw);
  if (result.success) return { ok: true, values: result.data };
  const errors: SettingsFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (isField(field) && errors[field] === undefined) errors[field] = issue.message;
  }
  return { ok: false, errors };
}

/** Lit un FormData en objet simple (une valeur texte par champ). */
export function formDataToRecord(form: FormData): Record<string, string> {
  const record: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") record[field] = value;
  }
  return record;
}
