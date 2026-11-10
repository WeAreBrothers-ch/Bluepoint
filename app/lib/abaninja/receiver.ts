import { z } from "zod";
import { uuidField } from "./input-validation";

/** Destinataire d'une facture : adresse existante + société OU personne (spec §2, variantes 2 et 3). */
export const receiverSchema = z.union([
  z.strictObject({ addressUuid: uuidField, companyUuid: uuidField }),
  z.strictObject({ addressUuid: uuidField, personUuid: uuidField }),
]);

export type InvoiceReceiver = z.infer<typeof receiverSchema>;
