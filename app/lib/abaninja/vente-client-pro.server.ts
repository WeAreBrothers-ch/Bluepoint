import { logError, logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import type { AddressInput } from "./address-input";
import { createAddress } from "./addresses.server";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import type { AbaNinjaError } from "./errors";
import { classifyCreateFailure } from "./invoice-errors";
import {
  claimProClient,
  markProClientUncertain,
  releaseProClient,
  retakeStaleProClient,
  saveProClient,
  type AbaNinjaTestClient,
  type ProClientIds,
} from "./vente-client-pro-repository.server";
import { STALE_MS } from "./vente-essai-resume";
import { PRO_TEST_CLIENT_NAME } from "./vente-positions";

/**
 * Le client pro fictif d'AbaNinja : créé une seule fois (la ligne est réservée avant), puis repris par chaque
 * bon et chaque facture d'essai d'un pro. Il n'est effacé que par « Effacer les factures d'essai ».
 */

/** Refus écrit pour Eliott ; `code` est un code court pour le journal, jamais une donnée client. */
export class ProClientError extends Error {
  override readonly name = "ProClientError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BUSY = "Le client pro fictif est en train d’être créé dans AbaNinja pour une autre commande. Réessayez dans un instant.";

function refused(code: string, message: string): Result<never, ProClientError> {
  return failure(new ProClientError(code, message));
}

/** Rien n'est gardé : la ligne est rendue pour qu'un nouvel essai crée le client. */
async function release(shop: string): Promise<void> {
  const released = await releaseProClient(shop);
  if (!released.ok) logError("Client pro fictif : réservation non rendue", released.error, { shop });
}

const UNCERTAIN = new ProClientError(
  "client_pro_incertain",
  "AbaNinja n’a pas confirmé la création du client pro fictif. Touchez « Effacer les factures d’essai » sur la page « Connexion AbaNinja » (tous les essais partent avec) : l’app dira quoi vérifier, puis en refera un au prochain essai.",
);

/** Refus net : rien n'existe, la réservation est rendue. Sans réponse claire : « à vérifier », jamais recréé en double. */
async function creationFailed(shop: string, error: AbaNinjaError): Promise<ProClientError> {
  if (classifyCreateFailure(error) === "refusee") {
    await release(shop);
    return new ProClientError(error.code, `AbaNinja n’a pas créé le client pro fictif : ${error.message}`);
  }
  const marked = await markProClientUncertain(shop);
  if (!marked.ok) logError("Client pro fictif à vérifier mais non noté", marked.error, { shop });
  return UNCERTAIN;
}

async function create(config: AbaNinjaConfig, shop: string, address: AddressInput, options: CallOptions): Promise<Result<ProClientIds, ProClientError>> {
  const created = await createAddress(config, address, { ...options, force: true });
  if (!created.ok) return failure(await creationFailed(shop, created.error));
  if (!("companyUuid" in created.value)) {
    await release(shop);
    return refused("client_personne", `AbaNinja a créé une personne « ${PRO_TEST_CLIENT_NAME} » au lieu d’une entreprise. Supprimez-la dans AbaNinja avant de réessayer.`);
  }
  const ids = { addressUuid: created.value.addressUuid, companyUuid: created.value.companyUuid };
  const saved = await saveProClient(shop, ids);
  // Pas gardé : il sert quand même à cette pièce, qui le note ; l'effacement des essais le retrouvera par elle.
  if (!saved.ok) logError("Client pro fictif créé dans AbaNinja mais non gardé", saved.error, { shop });
  else if (!saved.value) logError("Client pro fictif créé dans AbaNinja mais non gardé", new Error("Réservation reprise entre-temps"), { shop });
  logInfo("Client pro fictif créé dans AbaNinja", { shop });
  return success(ids);
}

function idsOf(client: AbaNinjaTestClient): ProClientIds | null {
  const { addressUuid, companyUuid } = client;
  return client.state === "cree" && addressUuid !== null && companyUuid !== null ? { addressUuid, companyUuid } : null;
}

/** Une création réservée par un autre appelant : on la reprend seulement si elle est restée en plan. */
async function retakeIfStale(shop: string, client: AbaNinjaTestClient, now: Date): Promise<Result<boolean, ProClientError>> {
  if (client.state === "incertain") return failure(UNCERTAIN);
  if (client.state !== "en_cours") return refused("client_pro_mal_note", "Le client pro fictif est mal noté dans l’app. Touchez « Effacer les factures d’essai », puis réessayez.");
  const staleBefore = new Date(now.getTime() - STALE_MS);
  if (client.updatedAt >= staleBefore) return success(false);
  const retaken = await retakeStaleProClient(shop, staleBefore, now);
  return retaken.ok ? retaken : refused("base", "L’app n’a pas pu lire le client pro fictif. Réessayez dans un instant.");
}

/** Le destinataire du client pro fictif : celui déjà gardé, sinon il est créé une fois et gardé. */
export async function proTestClient(
  config: AbaNinjaConfig,
  shop: string,
  address: AddressInput,
  now: Date,
  options: CallOptions = {},
): Promise<Result<ProClientIds, ProClientError>> {
  const claim = await claimProClient(shop);
  if (!claim.ok) {
    logError("Client pro fictif illisible", claim.error, { shop });
    return refused("base", "L’app n’a pas pu lire le client pro fictif. Réessayez dans un instant.");
  }
  if (claim.value.claimed) return create(config, shop, address, options);
  const ids = idsOf(claim.value.client);
  if (ids !== null) return success(ids);
  const retaken = await retakeIfStale(shop, claim.value.client, now);
  if (!retaken.ok) return retaken;
  return retaken.value ? create(config, shop, address, options) : refused("client_pro_en_cours", BUSY);
}
