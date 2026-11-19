import { z } from "zod";
import { uuidField } from "./input-validation";
import { envelope } from "./schemas";

/** Réponses AbaNinja sur les bons de livraison : tolérantes aux champs inconnus, strictes sur ce que l'app utilise. */

const createdNote = z.looseObject({ uuid: uuidField });

/** Création : 201 (bon créé) ou 202 (traitement asynchrone, résultat incertain). */
export const createDeliveryNoteResponseSchema = z.union([
  envelope(z.looseObject({ documents: z.tuple([createdNote]) })).transform((body) => ({
    kind: "cree" as const,
    uuid: body.data.documents[0].uuid,
  })),
  envelope(z.looseObject({ queueUuid: uuidField })).transform(() => ({ kind: "incertain" as const })),
]);

const noteRecord = z.looseObject({
  uuid: uuidField,
  status: z.string().min(1),
  reference: z.string().nullish(),
  deliveryNoteNumber: z.string().nullish(),
  receiver: z.looseObject({ companyUuid: uuidField.nullish() }).nullish(),
});

export type DeliveryNoteRecord = z.infer<typeof noteRecord>;

/** Lecture : `data` peut être le bon lui-même ou { documents: [bon] }. */
export const readDeliveryNoteResponseSchema = z.union([
  envelope(noteRecord).transform((body): DeliveryNoteRecord => body.data),
  envelope(z.looseObject({ documents: z.tuple([noteRecord]) })).transform((body): DeliveryNoteRecord => body.data.documents[0]),
]);

/** `convertDNI` : le document créé, qui doit être une facture. */
export const convertedDocumentResponseSchema = envelope(z.looseObject({ type: z.string(), uuid: uuidField }));
