import { z } from "zod";
import { failure, success, type Result } from "../core/result";
import { addressInputSchema, type AddressInput, type ValidAddressInput } from "./address-input";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { validateInput } from "./input-validation";
import type { InvoiceReceiver } from "./receiver";
import { createAddressResponseSchema } from "./schemas";

/** Création d'un client (société ou personne) dans AbaNinja, étiqueté « bluepoint-app ». */

const APP_TAG = "bluepoint-app";

/** Un client équivalent existe déjà dans AbaNinja (409). */
export class DuplicateAddressError extends AbaNinjaError {
  constructor() {
    super("donnees_refusees", {
      status: 409,
      message:
        "Ce client existe déjà dans AbaNinja (doublon détecté). Retrouvez-le dans AbaNinja plutôt que d'en créer un second.",
    });
  }
}

function buildContacts(input: ValidAddressInput): readonly object[] {
  const email = { type: "email", value: input.email, primary: true };
  return input.phone === undefined ? [email] : [email, { type: "phone", value: input.phone, primary: true }];
}

function buildPostalAddress(input: ValidAddressInput): object {
  return {
    address: input.street,
    ...(input.streetNumber === undefined ? {} : { street_number: input.streetNumber }),
    zip_code: input.zipCode,
    state: input.state,
    city: input.city,
    country_code: input.countryCode,
  };
}

/** Corps snake_case attendu par l'API Addresses. Jamais de `force` : un doublon doit remonter. */
function buildBody(input: ValidAddressInput): object {
  const shared = {
    language: input.language,
    tags: [APP_TAG],
    contacts: buildContacts(input),
    addresses: [buildPostalAddress(input)],
  };
  if (input.kind === "company") {
    return {
      type: "company",
      name: input.name,
      ...(input.vatNumber === undefined ? {} : { vat_number: input.vatNumber }),
      ...shared,
    };
  }
  return { type: "person", first_name: input.firstName, last_name: input.lastName, salutation: input.salutation, ...shared };
}

type CreatedAddress = z.infer<typeof createAddressResponseSchema>["data"];

/**
 * POINT D'INCERTITUDE n°8 de la spec : on suppose que `addressUuid` du
 * destinataire est l'uuid de l'adresse POSTALE (addresses[0].uuid) et que
 * `companyUuid` / `personUuid` est l'uuid du client lui-même. À vérifier en
 * conditions réelles ; c'est le seul endroit à corriger si c'est l'inverse.
 */
function toReceiver(kind: ValidAddressInput["kind"], created: CreatedAddress): Result<InvoiceReceiver, AbaNinjaError> {
  const addressUuid = created.addresses?.[0]?.uuid;
  if (addressUuid === undefined) {
    return failure(
      new AbaNinjaError("reponse_invalide", {
        message: "Le client a été créé dans AbaNinja mais sans adresse postale exploitable : vérifiez-le dans AbaNinja.",
      }),
    );
  }
  return success(kind === "company" ? { addressUuid, companyUuid: created.uuid } : { addressUuid, personUuid: created.uuid });
}

function mapError(error: AbaNinjaError): AbaNinjaError {
  return error.status === 409 ? new DuplicateAddressError() : error;
}

/** Crée le client et renvoie le destinataire à utiliser sur la facture. */
export async function createAddress(
  config: AbaNinjaConfig,
  input: AddressInput,
  options: CallOptions = {},
): Promise<Result<InvoiceReceiver, AbaNinjaError>> {
  const valid = validateInput(addressInputSchema, input, "Création du client AbaNinja");
  if (!valid.ok) return valid;
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "POST",
    path: ["accounts", { uuid: config.accountUuid }, "addresses", "v2", "addresses"],
    body: buildBody(valid.value),
    schema: createAddressResponseSchema,
  });
  if (!result.ok) return failure(mapError(result.error));
  return toReceiver(valid.value.kind, result.value.data);
}
