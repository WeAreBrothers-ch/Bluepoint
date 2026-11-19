import { z } from "zod";
import { hasConsecutiveNumbers, positionSchema } from "./invoice-input";
import { isoDate, singleLine } from "./input-validation";
import { receiverSchema } from "./receiver";

/** Bon de livraison à créer, tel que l'appelant le décrit (validé avant tout envoi). */

const MAX_POSITIONS = 200;

export const deliveryNoteInputSchema = z
  .strictObject({
    receiver: receiverSchema,
    /** Clé de rapprochement choisie par l'appelant, ex. « BP-1042 ». */
    reference: singleLine(255),
    title: singleLine(75).optional(),
    currencyCode: z.literal("CHF").default("CHF"),
    deliveryNoteDate: isoDate,
    deliveryDate: isoDate,
    pricesIncludeVat: z.boolean(),
    positions: z.array(positionSchema).min(1).max(MAX_POSITIONS),
  })
  .refine((note) => note.deliveryDate >= note.deliveryNoteDate, {
    path: ["deliveryDate"],
    message: "la livraison précède la date du bon",
  })
  .refine((note) => hasConsecutiveNumbers(note.positions), {
    path: ["positions"],
    message: "les numéros de position doivent aller de 1 à n sans trou ni doublon",
  });

export type AbaNinjaDeliveryNoteInput = z.input<typeof deliveryNoteInputSchema>;
export type ValidDeliveryNoteInput = z.output<typeof deliveryNoteInputSchema>;
