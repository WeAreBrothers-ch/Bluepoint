import { z } from "zod";
import { singleLine } from "./input-validation";

/**
 * Saisie d'un client à créer dans AbaNinja. Tout est validé avant envoi :
 * longueurs maximales, aucun caractère de contrôle, e-mail valide.
 */

const ADDRESS_LANGUAGES = ["fr", "de", "it", "en"] as const;

const language = z.enum(ADDRESS_LANGUAGES);

const common = {
  street: singleLine(100),
  streetNumber: singleLine(20).optional(),
  zipCode: singleLine(10),
  city: singleLine(100),
  email: singleLine(254).pipe(z.email()),
  phone: singleLine(30)
    .regex(/^[+0-9 ()./-]{5,30}$/, "numéro de téléphone invalide")
    .optional(),
  language,
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .default("CH"),
};

const companySchema = z.strictObject({
  kind: z.literal("company"),
  name: singleLine(150),
  vatNumber: singleLine(30)
    .regex(/^[A-Za-z0-9 .-]+$/, "numéro de TVA invalide")
    .optional(),
  ...common,
});

const personSchema = z.strictObject({
  kind: z.literal("person"),
  firstName: singleLine(80),
  lastName: singleLine(80),
  salutation: z.enum(["Mr", "Ms", "Family"]),
  ...common,
});

export const addressInputSchema = z.discriminatedUnion("kind", [companySchema, personSchema]);

export type AddressInput = z.input<typeof addressInputSchema>;
export type ValidAddressInput = z.output<typeof addressInputSchema>;
