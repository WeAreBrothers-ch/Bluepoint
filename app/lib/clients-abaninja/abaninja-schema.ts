import { z } from "zod";
import { uuidField } from "../abaninja/input-validation";

/**
 * Fiches clients lues dans AbaNinja (listes « companies » et « persons » de l'API Addresses v2).
 * Schéma volontairement tolérant : seul l'uuid est exigé, tout le reste peut manquer ou être vide.
 * Une fiche illisible est sautée (et comptée) au lieu de faire échouer toute la liste.
 */

const text = z.string().nullish();

const contactSchema = z.looseObject({
  type: text,
  value: text,
  is_primary: z.boolean().nullish(),
  primary: z.boolean().nullish(),
});

const postalAddressSchema = z.looseObject({
  address: text,
  street_number: text,
  extension: text,
  additional_field: text,
  zip_code: z.union([z.string(), z.number().transform(String)]).nullish(),
  city: text,
  country_code: text,
});

const contactPersonSchema = z.looseObject({
  first_name: text,
  last_name: text,
  contacts: z.array(contactSchema).nullish(),
});

export const abaNinjaRecordSchema = z.looseObject({
  uuid: uuidField,
  customer_number: z.union([z.string(), z.number().transform(String)]).nullish(),
  name: text,
  first_name: text,
  last_name: text,
  vat_number: text,
  language: text,
  tags: z.array(z.unknown()).nullish(),
  contacts: z.array(contactSchema).nullish(),
  addresses: z.array(postalAddressSchema).nullish(),
  contact_persons: z.array(contactPersonSchema).nullish(),
});

export type AbaNinjaRecord = z.input<typeof abaNinjaRecordSchema>;
export type AbaNinjaContact = z.output<typeof contactSchema>;

/** Une page de liste : les éléments sont validés un par un ensuite. */
export const abaNinjaPageSchema = z.looseObject({
  data: z.array(z.unknown()),
  // Nombre de pages : en chiffres ou en texte selon les réponses ; illisible → inconnu (on lit alors jusqu'à une page vide).
  meta: z.looseObject({ last_page: z.coerce.number().int().positive().nullish().catch(null) }).nullish(),
});
