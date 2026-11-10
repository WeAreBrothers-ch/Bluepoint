import { z } from "zod";
import { hasAtMostDecimals, isoDate, multiLine, singleLine, uuidField } from "./input-validation";
import { receiverSchema } from "./receiver";

/** Facture à créer, telle que l'appelant la décrit (validée avant tout envoi). */

const MAX_POSITIONS = 200;

const positionSchema = z.strictObject({
  positionNumber: z.number().int().min(1).max(MAX_POSITIONS),
  productNumber: singleLine(255).optional(),
  description: singleLine(500),
  /** Entier > 0 ou décimale (3 chiffres après la virgule au plus). */
  quantity: z
    .number()
    .positive()
    .max(1_000_000)
    .refine((value) => hasAtMostDecimals(value, 3), "3 décimales au plus"),
  /** Prix unitaire en CHF, 2 décimales au plus. */
  unitPrice: z
    .number()
    .min(0)
    .max(10_000_000)
    .refine((value) => hasAtMostDecimals(value, 2), "2 décimales au plus"),
  vatPercentage: z
    .number()
    .min(0)
    .max(100)
    .refine((value) => hasAtMostDecimals(value, 2), "2 décimales au plus"),
  discountPercentage: z.number().min(0).max(100).optional(),
});

function hasConsecutiveNumbers(positions: readonly { positionNumber: number }[]): boolean {
  const numbers = positions.map((position) => position.positionNumber).sort((a, b) => a - b);
  return numbers.every((value, index) => value === index + 1);
}

export const invoiceInputSchema = z
  .strictObject({
    receiver: receiverSchema,
    bankAccountUuid: uuidField,
    /** Clé de rapprochement choisie par l'appelant, ex. « BP-1042 ». */
    reference: singleLine(255),
    title: singleLine(75).optional(),
    currencyCode: z.literal("CHF").default("CHF"),
    invoiceDate: isoDate,
    dueDate: isoDate,
    pricesIncludeVat: z.boolean(),
    terms: multiLine(2000).optional(),
    publicNotes: multiLine(2000).optional(),
    positions: z.array(positionSchema).min(1).max(MAX_POSITIONS),
  })
  .refine((invoice) => invoice.dueDate >= invoice.invoiceDate, {
    path: ["dueDate"],
    message: "l'échéance précède la date de facture",
  })
  .refine((invoice) => hasConsecutiveNumbers(invoice.positions), {
    path: ["positions"],
    message: "les numéros de position doivent aller de 1 à n sans trou ni doublon",
  });

export type AbaNinjaInvoiceInput = z.input<typeof invoiceInputSchema>;
export type ValidInvoiceInput = z.output<typeof invoiceInputSchema>;
