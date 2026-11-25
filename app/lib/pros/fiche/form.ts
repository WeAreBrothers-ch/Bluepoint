import type { z } from "zod";
import { PRO_CONTACT_RULES } from "../request";
import type { FichePart } from "./state";

/**
 * Formulaire « Compléter ma fiche pro » : seuls les champs de ce qui manque sont montrés et vérifiés. Ce qui est déjà
 * enregistré n'est jamais remplacé depuis le site (BluePoint garde la main sur une adresse de livraison connue).
 * Mêmes règles et mêmes phrases d'erreur que la demande de compte pro. Logique pure, testée.
 */

export const FICHE_FIELDS = ["firstName", "lastName", "phone", "street", "postalCode", "city", "country"] as const;

export type FicheField = (typeof FICHE_FIELDS)[number];
export type FicheValues = Readonly<Record<FicheField, string>>;
export type FicheErrors = Partial<Record<FicheField, string>>;

export const EMPTY_FICHE: FicheValues = {
  firstName: "",
  lastName: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: "CH",
};

const PART_FIELDS: Readonly<Record<FichePart, readonly FicheField[]>> = {
  name: ["firstName", "lastName"],
  phone: ["phone"],
  address: ["street", "postalCode", "city", "country"],
};

export interface FicheAddressUpdate {
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: "CH" | "LI";
}

export interface FicheUpdate {
  readonly name: { readonly firstName: string; readonly lastName: string } | null;
  readonly phone: string | null;
  readonly address: FicheAddressUpdate | null;
}

export type FicheParse =
  | { readonly ok: true; readonly value: FicheUpdate }
  | { readonly ok: false; readonly errors: FicheErrors; readonly values: FicheValues };

export function fieldsFor(parts: readonly FichePart[]): readonly FicheField[] {
  return parts.flatMap((part) => PART_FIELDS[part]);
}

/** Lit un formulaire (FormData ou URLSearchParams) en valeurs texte, champ par champ. */
export function readFicheForm(form: { get(name: string): FormDataEntryValue | null }): FicheValues {
  const values: Record<FicheField, string> = { ...EMPTY_FICHE };
  for (const field of FICHE_FIELDS) {
    const value = form.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

export function parseFiche(parts: readonly FichePart[], values: FicheValues): FicheParse {
  const errors: FicheErrors = {};
  const check = <T>(part: FichePart, field: FicheField, rule: z.ZodType<T>): T | null => {
    if (!parts.includes(part)) return null;
    const result = rule.safeParse(values[field]);
    if (result.success) return result.data;
    errors[field] = result.error.issues[0]?.message ?? "Valeur à corriger.";
    return null;
  };
  const firstName = check("name", "firstName", PRO_CONTACT_RULES.firstName);
  const lastName = check("name", "lastName", PRO_CONTACT_RULES.lastName);
  const phone = check("phone", "phone", PRO_CONTACT_RULES.phone);
  const street = check("address", "street", PRO_CONTACT_RULES.street);
  const postalCode = check("address", "postalCode", PRO_CONTACT_RULES.postalCode);
  const city = check("address", "city", PRO_CONTACT_RULES.city);
  const country = check("address", "country", PRO_CONTACT_RULES.country);
  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return {
    ok: true,
    value: {
      name: firstName !== null && lastName !== null ? { firstName, lastName } : null,
      phone,
      address: street !== null && postalCode !== null && city !== null && country !== null ? { street, postalCode, city, country } : null,
    },
  };
}
