import { z } from "zod";
import { failure, success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { buildDeliveryNoteBody } from "./delivery-note-body";
import { deliveryNoteInputSchema, type AbaNinjaDeliveryNoteInput } from "./delivery-note-input";
import {
  convertedDocumentResponseSchema,
  createDeliveryNoteResponseSchema,
  readDeliveryNoteResponseSchema,
} from "./delivery-note-schemas";
import { listDocumentActionNames } from "./document-actions.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { validateInput } from "./input-validation";
import type { PathSegment } from "./path";

/**
 * Bons de livraison AbaNinja : créer, relire, mettre à jour, annuler, transformer en facture, supprimer.
 * Aucune de ces fonctions n'envoie quoi que ce soit à un client.
 */

export type CreatedDeliveryNote = { readonly kind: "cree"; readonly uuid: string } | { readonly kind: "incertain" };

export interface DeliveryNoteDetails {
  readonly uuid: string;
  readonly status: string;
  readonly reference: string | null;
  readonly number: string | null;
  readonly companyUuid: string | null;
}

function noteSegments(config: AbaNinjaConfig, ...tail: readonly PathSegment[]): readonly PathSegment[] {
  return ["accounts", { uuid: config.accountUuid }, "documents", "v2", "delivery-notes", ...tail];
}

/** Crée UN bon. Jamais de réessai : un POST rejoué créerait un doublon. « incertain » = AbaNinja l'a mis en file. */
export async function createDeliveryNote(
  config: AbaNinjaConfig,
  input: AbaNinjaDeliveryNoteInput,
  options: CallOptions = {},
): Promise<Result<CreatedDeliveryNote, AbaNinjaError>> {
  const valid = validateInput(deliveryNoteInputSchema, input, "Création du bon de livraison");
  if (!valid.ok) return valid;
  return abaNinjaRequest({
    ...options,
    config,
    method: "POST",
    path: noteSegments(config),
    body: buildDeliveryNoteBody(valid.value),
    idempotent: false,
    schema: createDeliveryNoteResponseSchema,
  });
}

/** Relit un bon ; refuse une réponse qui concerne un autre bon. */
export async function getDeliveryNote(
  config: AbaNinjaConfig,
  noteUuid: string,
  options: CallOptions = {},
): Promise<Result<DeliveryNoteDetails, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "GET",
    path: noteSegments(config, { uuid: noteUuid }),
    schema: readDeliveryNoteResponseSchema,
  });
  if (!result.ok) return result;
  const record = result.value;
  if (record.uuid.toLowerCase() !== noteUuid.toLowerCase()) return failure(new AbaNinjaError("reponse_invalide"));
  return success({
    uuid: record.uuid,
    status: record.status,
    reference: record.reference ?? null,
    number: record.deliveryNoteNumber ?? null,
    companyUuid: record.receiver?.companyUuid ?? null,
  });
}

/** `convertDNI` : crée la facture à partir du bon et renvoie son identifiant. Jamais rejoué (créerait deux factures). */
export async function convertDeliveryNoteToInvoice(
  config: AbaNinjaConfig,
  noteUuid: string,
  options: CallOptions = {},
): Promise<Result<string, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: noteSegments(config, { uuid: noteUuid }, "actions", "convertDNI"),
    idempotent: false,
    schema: convertedDocumentResponseSchema,
  });
  if (!result.ok) return result;
  const created = result.value.data;
  return created.type === "invoice" ? success(created.uuid) : failure(new AbaNinjaError("reponse_invalide"));
}

/** Remplace le bon par ce corps (document entier, même schéma que la création) : rejouable sans risque. */
export async function updateDeliveryNote(
  config: AbaNinjaConfig,
  noteUuid: string,
  input: AbaNinjaDeliveryNoteInput,
  options: CallOptions = {},
): Promise<Result<void, AbaNinjaError>> {
  const valid = validateInput(deliveryNoteInputSchema, input, "Mise à jour du bon de livraison");
  if (!valid.ok) return valid;
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: noteSegments(config, { uuid: noteUuid }),
    body: buildDeliveryNoteBody(valid.value),
    idempotent: true,
    schema: z.unknown(),
  });
  return result.ok ? success(undefined) : result;
}

/** Annule le bon pour de bon (« cancelPermanently » : plus modifiable ensuite), rejouable sans risque. */
export async function cancelDeliveryNote(config: AbaNinjaConfig, noteUuid: string, options: CallOptions = {}): Promise<Result<void, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: noteSegments(config, { uuid: noteUuid }, "actions", "cancelPermanently"),
    idempotent: true,
    schema: z.unknown(),
  });
  return result.ok ? success(undefined) : result;
}

/** Supprime un bon (action « delete », rejouable sans risque). */
export async function deleteDeliveryNote(
  config: AbaNinjaConfig,
  noteUuid: string,
  options: CallOptions = {},
): Promise<Result<void, AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "PATCH",
    path: noteSegments(config, { uuid: noteUuid }, "actions", "delete"),
    idempotent: true,
    schema: z.unknown(),
  });
  return result.ok ? success(undefined) : result;
}

/** Actions qu'AbaNinja autorise sur ce bon (diagnostic : dit par exemple si un brouillon peut devenir facture). */
export async function listDeliveryNoteActionNames(
  config: AbaNinjaConfig,
  noteUuid: string,
  options: CallOptions = {},
): Promise<Result<string[], AbaNinjaError>> {
  return listDocumentActionNames(config, noteSegments(config, { uuid: noteUuid }, "actions"), options);
}
