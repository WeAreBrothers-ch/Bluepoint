import { z } from "zod";
import { DELIVERY_MODES, parseIsoDate, type IsoDate } from "../metafields/definitions";
import { parseGid } from "../shopify/ids";
import { MAX_LINE_QUANTITY, PAYMENT_CHOICES, type B2bPurchaser, type PhoneOrderInput, type PhoneOrderLine } from "./types";

/**
 * Validation de la commande par téléphone envoyée par le navigateur.
 * Tout est revérifié côté serveur : identifiants Shopify, quantités, dates, choix.
 */

const NOTE_MAX = 5000;

function gid<TResource extends string>(resource: TResource, message: string) {
  return z
    .string(message)
    .transform((value, ctx) => {
      const parsed = parseGid(value, resource);
      if (parsed === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return parsed;
    });
}

const isoDate = (message: string) =>
  z.string(message).transform((value, ctx): IsoDate => {
    const parsed = parseIsoDate(value);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

const lineSchema = z.object({
  variantId: gid("ProductVariant", "Produit inconnu."),
  quantity: z
    .number("Quantité invalide.")
    .int("Quantité entière attendue.")
    .min(1, "Au moins 1 bouteille par ligne.")
    .max(MAX_LINE_QUANTITY, `${MAX_LINE_QUANTITY} bouteilles au plus par ligne.`),
});

const b2bSchema = z.object({
  companyId: gid("Company", "Choisissez à nouveau le client."),
  companyContactId: gid("CompanyContact", "Choisissez à nouveau le client."),
  companyLocationId: gid("CompanyLocation", "Choisissez à nouveau le client."),
});

const linesSchema = z
  .array(lineSchema, "Liste de produits invalide.")
  .min(1, "Ajoutez au moins une bouteille.")
  .max(250, "250 lignes au plus par commande.")
  .refine((lines) => new Set(lines.map((line) => line.variantId)).size === lines.length, "Un produit apparaît deux fois.");

export const phoneOrderSchema = z
  .object({
    idempotencyKey: z.uuid("Rechargez la page, puis recommencez la commande."),
    customerId: gid("Customer", "Choisissez un client."),
    b2b: b2bSchema.nullable(),
    lines: linesSchema,
    requestedDate: isoDate("Choisissez le jour de livraison."),
    deadline: isoDate("Choisissez la date limite."),
    mode: z.enum(DELIVERY_MODES, "Choisissez un mode de livraison."),
    note: z.string("Remarque invalide.").trim().max(NOTE_MAX, `${NOTE_MAX} caractères au plus.`),
    payment: z.enum(PAYMENT_CHOICES, "Choisissez comment le client paie."),
  })
  .refine((order) => order.deadline >= order.requestedDate, {
    path: ["deadline"],
    message: "La date limite doit être le jour de livraison ou après.",
  });

export type PhoneOrderField = keyof z.input<typeof phoneOrderSchema>;
export type PhoneOrderErrors = Partial<Record<PhoneOrderField, string>>;

export type ParseResult<TValue> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly errors: PhoneOrderErrors };

const FIELDS: readonly string[] = Object.keys(phoneOrderSchema.shape);

function isField(value: PropertyKey | undefined): value is PhoneOrderField {
  return typeof value === "string" && FIELDS.includes(value);
}

function collectErrors(issues: readonly z.core.$ZodIssue[]): PhoneOrderErrors {
  const errors: PhoneOrderErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (isField(field) && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}

/** `today` : jour civil suisse ; une livraison ne peut pas être prévue dans le passé. */
export function parsePhoneOrder(raw: unknown, today: IsoDate): ParseResult<PhoneOrderInput> {
  const result = phoneOrderSchema.safeParse(raw);
  if (!result.success) return { ok: false, errors: collectErrors(result.error.issues) };
  if (result.data.requestedDate < today) {
    return { ok: false, errors: { requestedDate: "Ce jour est déjà passé\u202F: choisissez aujourd’hui ou plus tard." } };
  }
  return { ok: true, value: result.data };
}

const calculationSchema = z.object({
  customerId: gid("Customer", "Choisissez un client."),
  b2b: b2bSchema.nullable(),
  lines: linesSchema,
});

export interface PriceCalculationInput {
  readonly customerId: PhoneOrderInput["customerId"];
  readonly b2b: B2bPurchaser | null;
  readonly lines: readonly PhoneOrderLine[];
}

/** Demande des prix de ce client (catalogue B2B de l'entreprise, remise pro automatique…). */
export function parsePriceCalculation(raw: unknown): PriceCalculationInput | null {
  const result = calculationSchema.safeParse(raw);
  return result.success ? result.data : null;
}
