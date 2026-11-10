import { Prisma } from "@prisma/client";
import prisma from "../../db.server";
import { failure, success, toError, type Result } from "../core/result";
import {
  AbaNinjaRepositoryError,
  InvalidTransitionError,
  type AbaNinjaInvoice,
  type ClaimInput,
  type ClaimOutcome,
  type CleanupIssueCode,
  type CreatedInvoice,
  type InvoiceState,
  type StatusUpdate,
} from "./repository-types";

/**
 * Verrou en base des factures AbaNinja. AbaNinja ne protège pas des doublons :
 * on prend le verrou AVANT l'appel, et on ne rejoue jamais un envoi incertain.
 * Chaque changement d'état est un UPDATE conditionnel atomique (jamais « lire puis écrire »).
 */

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function guarded<T>(task: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return success(await task());
  } catch (thrown) {
    return failure(toError(thrown));
  }
}

/** Passe de `from` à un nouvel état en une seule requête ; refusé si l'état actuel est différent. */
async function transition(
  orderId: string,
  from: InvoiceState,
  data: Prisma.AbaNinjaInvoiceUpdateManyMutationInput,
): Promise<Result<AbaNinjaInvoice, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaInvoice.updateMany({ where: { orderId, state: from }, data });
    const invoice = await prisma.abaNinjaInvoice.findUnique({ where: { orderId } });
    if (count !== 1 || !invoice) throw new InvalidTransitionError(orderId, from);
    return invoice;
  });
}

/** Prend le verrou. Si la ligne existe déjà, elle est renvoyée telle quelle avec claimed:false. */
export async function claimInvoiceSlot(input: ClaimInput): Promise<Result<ClaimOutcome, Error>> {
  return guarded(async () => {
    try {
      const invoice = await prisma.abaNinjaInvoice.create({ data: { ...input, state: "en_cours", attempts: 1 } });
      return { invoice, claimed: true };
    } catch (thrown) {
      if (!isUniqueViolation(thrown)) throw thrown;
      const existing = await prisma.abaNinjaInvoice.findUnique({ where: { orderId: input.orderId } });
      if (!existing) throw new AbaNinjaRepositoryError("Référence déjà utilisée par une autre commande.", "reference_deja_prise");
      return { invoice: existing, claimed: false };
    }
  });
}

export function markCreated(orderId: string, created: CreatedInvoice): Promise<Result<AbaNinjaInvoice, Error>> {
  return transition(orderId, "en_cours", { state: "creee", ...created, lastErrorCode: null });
}

export function markUncertain(orderId: string, errorCode: string): Promise<Result<AbaNinjaInvoice, Error>> {
  return transition(orderId, "en_cours", { state: "incertaine", lastErrorCode: errorCode });
}

export function markRefused(orderId: string, errorCode: string): Promise<Result<AbaNinjaInvoice, Error>> {
  return transition(orderId, "en_cours", { state: "refusee", lastErrorCode: errorCode });
}

/** Note le dernier statut lu chez AbaNinja (uniquement pour une facture confirmée). */
export function recordStatus(orderId: string, update: StatusUpdate): Promise<Result<AbaNinjaInvoice, Error>> {
  return transition(orderId, "creee", { ...update, statusCheckedAt: new Date() });
}

/** Décision humaine pour une facture incertaine : trouvée dans AbaNinja (creee) ou « absente » (refusee). */
export function resolveUncertain(orderId: string, outcome: CreatedInvoice | "absente"): Promise<Result<AbaNinjaInvoice, Error>> {
  if (outcome === "absente") return transition(orderId, "incertaine", { state: "refusee" });
  return transition(orderId, "incertaine", { state: "creee", ...outcome });
}

/** Note ce qui reste à supprimer à la main après un essai, sans changer l'état de la ligne. */
export async function recordCleanupIssue(orderId: string, code: CleanupIssueCode): Promise<Result<void, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaInvoice.updateMany({ where: { orderId }, data: { lastErrorCode: code } });
    if (count !== 1) throw new AbaNinjaRepositoryError("Essai introuvable en base.", "essai_introuvable");
  });
}
