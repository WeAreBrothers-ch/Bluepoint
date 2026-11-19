import { Prisma, type AbaNinjaTestClient } from "@prisma/client";
import prisma from "../../db.server";
import { failure, success, toError, type Result } from "../core/result";

/**
 * Le client pro fictif d'AbaNinja, un seul par boutique. La ligne est prise AVANT de créer le client
 * (AbaNinja ne protège pas des doublons) : un seul appelant le crée. Chaque changement d'état est un
 * UPDATE ou un DELETE conditionnel : un appelant en retard ne touche jamais un client plus récent.
 */

export type { AbaNinjaTestClient };

const KIND = "pro";

export interface ProClientIds {
  readonly addressUuid: string;
  readonly companyUuid: string;
}

async function guarded<T>(task: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return success(await task());
  } catch (thrown) {
    return failure(toError(thrown));
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function find(shop: string): Promise<AbaNinjaTestClient | null> {
  return prisma.abaNinjaTestClient.findUnique({ where: { shop_kind: { shop, kind: KIND } } });
}

export function findProClient(shop: string): Promise<Result<AbaNinjaTestClient | null, Error>> {
  return guarded(() => find(shop));
}

/** Réserve la création du client ; si la ligne existe déjà, la renvoie avec claimed:false (l'appelant ne crée rien). */
export function claimProClient(shop: string): Promise<Result<{ readonly client: AbaNinjaTestClient; readonly claimed: boolean }, Error>> {
  return guarded(async () => {
    try {
      return { client: await prisma.abaNinjaTestClient.create({ data: { shop, kind: KIND, state: "en_cours" } }), claimed: true };
    } catch (thrown) {
      if (!isUniqueViolation(thrown)) throw thrown;
      const existing = await find(shop);
      if (existing === null) throw new Error("Client pro fictif effacé pendant sa réservation");
      return { client: existing, claimed: false };
    }
  });
}

/** Reprend une création restée en plan (appelant arrêté en route) ; vrai pour un seul appelant. */
export function retakeStaleProClient(shop: string, staleBefore: Date, now: Date): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaTestClient.updateMany({
      where: { shop, kind: KIND, state: "en_cours", updatedAt: { lt: staleBefore } },
      data: { updatedAt: now },
    });
    return count === 1;
  });
}

/** Garde le client créé ; faux si la création n'était plus réservée (rien n'est changé). */
export function saveProClient(shop: string, ids: ProClientIds): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaTestClient.updateMany({ where: { shop, kind: KIND, state: "en_cours" }, data: { state: "cree", ...ids } });
    return count === 1;
  });
}

/** Création refusée (rien n'existe dans AbaNinja) : la réservation disparaît, un nouvel essai la reprendra. */
export function releaseProClient(shop: string): Promise<Result<void, Error>> {
  return guarded(async () => {
    await prisma.abaNinjaTestClient.deleteMany({ where: { shop, kind: KIND, state: "en_cours" } });
  });
}

/** Création sans réponse claire : le client existe peut-être, il est « à vérifier » et rien n'est recréé d'ici là. */
export function markProClientUncertain(shop: string): Promise<Result<void, Error>> {
  return guarded(async () => {
    await prisma.abaNinjaTestClient.updateMany({ where: { shop, kind: KIND, state: "en_cours" }, data: { state: "incertain" } });
  });
}

/**
 * Effacement des essais : oublie une ligne sans client gardé (« à vérifier », ou création restée en plan depuis
 * `staleBefore`) ; jamais une création en cours ni un client gardé. Vrai si une ligne a été oubliée.
 */
export function dropProClientReservation(shop: string, staleBefore: Date): Promise<Result<boolean, Error>> {
  return guarded(async () => {
    const { count } = await prisma.abaNinjaTestClient.deleteMany({
      where: { shop, kind: KIND, companyUuid: null, OR: [{ state: { not: "en_cours" } }, { updatedAt: { lt: staleBefore } }] },
    });
    return count === 1;
  });
}

/** Le client a été effacé dans AbaNinja : la ligne disparaît, seulement si elle désigne encore CE client. */
export function forgetProClient(shop: string, companyUuid: string): Promise<Result<void, Error>> {
  return guarded(async () => {
    await prisma.abaNinjaTestClient.deleteMany({ where: { shop, kind: KIND, companyUuid } });
  });
}
