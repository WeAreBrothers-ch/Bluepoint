import { z } from "zod";
import { normalizePhoneE164 } from "../factures/phone";
import { normalizeVatNumber } from "../reglages/identifiers";

/**
 * Demande de compte pro : champs du formulaire « Devenir client pro » (site) et « Ajouter un client pro » (app),
 * avec des messages d'erreur en français simple. Logique pure, testée sans base ni Shopify.
 */

export const PRO_REQUEST_FIELDS = [
  "companyName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "street",
  "postalCode",
  "city",
  "country",
  "vatNumber",
  "message",
] as const;

export type ProRequestField = (typeof PRO_REQUEST_FIELDS)[number];

/** Valeurs telles que saisies (pour réafficher le formulaire). */
export type ProRequestValues = Readonly<Record<ProRequestField, string>>;
export type ProRequestErrors = Partial<Record<ProRequestField, string>>;

/** Champ caché : un robot le remplit, une personne ne le voit pas. */
export const HONEYPOT_FIELD = "site_web";

export const PRO_COUNTRIES = [
  { code: "CH", label: "Suisse" },
  { code: "LI", label: "Liechtenstein" },
] as const;

export const EMPTY_PRO_REQUEST: ProRequestValues = {
  companyName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: "CH",
  vatNumber: "",
  message: "",
};

const required = (what: string, max: number) =>
  z.string().trim().min(1, `${what} est obligatoire.`).max(max, `${max} caractères au plus.`);

const proRequestSchema = z.object({
  companyName: required("Le nom de l’entreprise", 70),
  firstName: required("Le prénom", 40),
  lastName: required("Le nom", 40),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide (exemple\u202F: nom@restaurant.ch).")),
  phone: z.string().transform((raw, ctx) => {
    const phone = normalizePhoneE164(raw);
    if (phone === null) {
      ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide (exemple\u202F: 079 123 45 67)." });
      return z.NEVER;
    }
    return phone;
  }),
  street: required("La rue et le numéro", 70),
  postalCode: z.string().trim().regex(/^\d{4}$/, "NPA à 4 chiffres (exemple\u202F: 1095)."),
  city: required("La localité", 35),
  country: z.enum(["CH", "LI"], { message: "Choisissez Suisse ou Liechtenstein." }),
  vatNumber: z.string().transform((raw, ctx) => {
    if (raw.trim() === "") return null;
    const vat = normalizeVatNumber(raw);
    if (vat === null) {
      ctx.addIssue({ code: "custom", message: "Numéro TVA invalide (exemple\u202F: CHE-123.456.789 TVA). Laissez vide si vous n’en avez pas." });
      return z.NEVER;
    }
    return vat;
  }),
  message: z
    .string()
    .trim()
    .max(500, "500 caractères au plus.")
    .transform((value) => (value === "" ? null : value)),
});

export type ProRequestInput = z.output<typeof proRequestSchema>;

export type ProRequestParse =
  | { readonly ok: true; readonly value: ProRequestInput }
  | { readonly ok: false; readonly errors: ProRequestErrors; readonly values: ProRequestValues };

function isField(value: PropertyKey | undefined): value is ProRequestField {
  return typeof value === "string" && (PRO_REQUEST_FIELDS as readonly string[]).includes(value);
}

/** Lit un formulaire (FormData ou URLSearchParams) en valeurs texte, champ par champ. */
export function readProRequestForm(form: { get(name: string): FormDataEntryValue | null }): ProRequestValues {
  const values: Record<string, string> = { ...EMPTY_PRO_REQUEST };
  for (const field of PRO_REQUEST_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values as ProRequestValues;
}

export function parseProRequest(values: ProRequestValues): ProRequestParse {
  const result = proRequestSchema.safeParse(values);
  if (result.success) return { ok: true, value: result.data };
  const errors: ProRequestErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (isField(field) && errors[field] === undefined) errors[field] = issue.message;
  }
  return { ok: false, errors, values };
}

/** Le champ piège est rempli : c'est un robot, on fait comme si tout allait bien sans rien garder. */
export function isRobot(form: { get(name: string): FormDataEntryValue | null }): boolean {
  const trap = form.get(HONEYPOT_FIELD);
  return typeof trap === "string" && trap.trim() !== "";
}
