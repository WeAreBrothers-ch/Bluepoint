import { z } from "zod";
import { normalizePhoneE164 } from "../factures/phone";

/**
 * « Nouveau client » dans « Prendre une commande » : la fiche est créée sans quitter l'app.
 * Nom et téléphone suffisent ; l'adresse est demandée pour livrer (facultative pour un retrait).
 * Logique pure, testée sans Shopify.
 */

export const NEW_CUSTOMER_FIELDS = ["firstName", "lastName", "phone", "email", "street", "postalCode", "city"] as const;

export type NewCustomerField = (typeof NEW_CUSTOMER_FIELDS)[number];
export type NewCustomerValues = Readonly<Record<NewCustomerField, string>>;
export type NewCustomerErrors = Partial<Record<NewCustomerField, string>>;

export const EMPTY_NEW_CUSTOMER: NewCustomerValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  street: "",
  postalCode: "",
  city: "",
};

const required = (what: string) => z.string().trim().min(1, `${what} est obligatoire.`).max(60, "60 caractères au plus.");

const schema = z
  .object({
    firstName: required("Le prénom"),
    lastName: required("Le nom"),
    phone: z.string().transform((raw, ctx) => {
      const phone = normalizePhoneE164(raw);
      if (phone === null) {
        ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide (exemple\u202F: 079 123 45 67)." });
        return z.NEVER;
      }
      return phone;
    }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => value === "" || z.email().safeParse(value).success, "Adresse e-mail invalide (ou laissez vide).")
      .transform((value) => (value === "" ? null : value)),
    street: z.string().trim().max(70, "70 caractères au plus."),
    postalCode: z.string().trim(),
    city: z.string().trim().max(35, "35 caractères au plus."),
  })
  .superRefine((value, ctx) => {
    // L'adresse est facultative, mais complète si elle est commencée.
    const started = value.street !== "" || value.postalCode !== "" || value.city !== "";
    if (!started) return;
    if (value.street === "") ctx.addIssue({ code: "custom", path: ["street"], message: "La rue et le numéro sont obligatoires." });
    if (!/^\d{4}$/.test(value.postalCode)) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "NPA à 4 chiffres (exemple\u202F: 1095)." });
    if (value.city === "") ctx.addIssue({ code: "custom", path: ["city"], message: "La localité est obligatoire." });
  });

export type NewCustomerInput = z.output<typeof schema>;

export type NewCustomerParse =
  | { readonly ok: true; readonly value: NewCustomerInput }
  | { readonly ok: false; readonly errors: NewCustomerErrors; readonly values: NewCustomerValues };

function isField(value: PropertyKey | undefined): value is NewCustomerField {
  return typeof value === "string" && (NEW_CUSTOMER_FIELDS as readonly string[]).includes(value);
}

export function readNewCustomerForm(form: { get(name: string): FormDataEntryValue | null }): NewCustomerValues {
  const values: Record<string, string> = { ...EMPTY_NEW_CUSTOMER };
  for (const field of NEW_CUSTOMER_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values as NewCustomerValues;
}

export function parseNewCustomer(values: NewCustomerValues): NewCustomerParse {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, value: result.data };
  const errors: NewCustomerErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (isField(field) && errors[field] === undefined) errors[field] = issue.message;
  }
  return { ok: false, errors, values };
}

/**
 * Préremplit le formulaire avec ce qui a été tapé dans la recherche :
 * un numéro va dans « Téléphone », un nom dans « Prénom » et « Nom ».
 */
export function prefillFromSearch(term: string): NewCustomerValues {
  const text = term.trim();
  if (text === "") return EMPTY_NEW_CUSTOMER;
  if (/^[+\d][\d\s().-]*$/.test(text)) return { ...EMPTY_NEW_CUSTOMER, phone: text };
  const [first = "", ...rest] = text.split(/\s+/);
  return { ...EMPTY_NEW_CUSTOMER, firstName: first, lastName: rest.join(" ") };
}

/** Entrée `CustomerInput` de Shopify. */
export function toCustomerInput(input: NewCustomerInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    locale: "fr",
    ...(input.email === null ? {} : { email: input.email }),
    ...(input.street === ""
      ? {}
      : {
          addresses: [
            {
              firstName: input.firstName,
              lastName: input.lastName,
              address1: input.street,
              zip: input.postalCode,
              city: input.city,
              countryCode: "CH",
              phone: input.phone,
            },
          ],
        }),
  };
}
