import { z } from "zod";
import { uuidField } from "./input-validation";

/**
 * Schémas des réponses AbaNinja. Tolérants aux champs inconnus (looseObject),
 * stricts sur ce dont l'app a besoin (uuid valides, statuts en texte).
 */

/** Enveloppe commune { data, message, status, meta } : seul `data` est exigé. */
export function envelope<TData extends z.ZodType>(data: TData) {
  return z.looseObject({
    data,
    message: z.string().optional(),
    status: z.number().optional(),
    meta: z.unknown().optional(),
  });
}

/** Nombre reçu soit en nombre, soit en texte numérique ("12.50"). */
const looseNumber = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);

const invoiceRecord = z.looseObject({
  uuid: uuidField,
  status: z.string().min(1),
  sentStatus: z.string().nullish(),
  openAmount: looseNumber.nullish(),
  dueDate: z.string().nullish(),
  systemInvoiceNumber: z.string().nullish(),
  isCancelled: z.boolean().optional(),
});

export type InvoiceRecord = z.infer<typeof invoiceRecord>;

const createdDocument = z.looseObject({ uuid: uuidField, systemInvoiceNumber: z.string().nullish() });

/** Création : 201 (facture créée) ou 202 (traitement asynchrone, résultat incertain). */
export const createInvoiceResponseSchema = z.union([
  envelope(z.looseObject({ documents: z.tuple([createdDocument], createdDocument) })).transform((body) => ({
    kind: "created" as const,
    documents: body.data.documents,
  })),
  envelope(z.looseObject({ queueUuid: uuidField })).transform((body) => ({
    kind: "queued" as const,
    queueUuid: body.data.queueUuid,
  })),
]);

/**
 * Lecture : `data` peut être la facture elle-même OU { documents: [facture] }
 * (forme non tranchée par la documentation). Les deux sont acceptées.
 */
export const readInvoiceResponseSchema = z.union([
  envelope(invoiceRecord).transform((body): InvoiceRecord => body.data),
  envelope(z.looseObject({ documents: z.tuple([invoiceRecord], invoiceRecord) })).transform(
    (body): InvoiceRecord => body.data.documents[0],
  ),
]);

export const downloadPdfResponseSchema = envelope(z.looseObject({ downloadUrl: z.string().min(1).max(2048) }));

const bankAccountRecord = z.looseObject({
  uuid: uuidField,
  name: z.string().nullish(),
  isActive: z.boolean(),
  isDefault: z.boolean().default(false),
  qrBill: z.looseObject({ active: z.boolean(), qrIban: z.string().nullish() }).nullish(),
});

export type BankAccountRecord = z.infer<typeof bankAccountRecord>;

export const bankAccountsResponseSchema = envelope(z.array(bankAccountRecord));

/** Création d'adresse : `uuid` de la société/personne et ses adresses postales. */
export const createAddressResponseSchema = envelope(
  z.looseObject({
    uuid: uuidField,
    addresses: z.array(z.looseObject({ uuid: uuidField })).optional(),
  }),
);
