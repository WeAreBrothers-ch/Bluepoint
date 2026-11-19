import type { ProRequest } from "@prisma/client";
import prisma from "../../db.server";
import type { ProRequestInput } from "./request";

/** Demandes de compte pro en base (table ProRequest). */

export type ProRequestSource = "site" | "app";

/** Au-delà, le formulaire du site refuse poliment : protège la base contre un envoi en masse. */
export const MAX_PENDING_REQUESTS = 50;

export type SaveResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly reason: "trop_de_demandes" };

function fields(input: ProRequestInput) {
  return {
    companyName: input.companyName,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    street: input.street,
    postalCode: input.postalCode,
    city: input.city,
    country: input.country,
    vatNumber: input.vatNumber,
    message: input.message,
  };
}

/** Une seule demande en attente par e-mail. */
function findPending(shop: string, email: string): Promise<ProRequest | null> {
  return prisma.proRequest.findFirst({ where: { shop, status: "en_attente", email: { equals: email, mode: "insensitive" } } });
}

/**
 * Demande déjà en attente pour cet e-mail. Depuis le site, on la garde telle quelle : n'importe qui peut taper
 * l'e-mail d'un autre, il ne doit pas pouvoir remplacer son adresse ou son téléphone. Le visiteur voit le même
 * « Merci » que d'habitude. Seule l'équipe corrige une demande, depuis l'app.
 */
async function keepOrUpdatePending(id: string, input: ProRequestInput, source: ProRequestSource): Promise<SaveResult> {
  if (source === "app") await prisma.proRequest.update({ where: { id }, data: fields(input) });
  return { ok: true, id };
}

/** Erreur Prisma « valeur déjà prise » (P2002) : l'index unique a bloqué un doublon. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

export async function saveProRequest(shop: string, input: ProRequestInput, source: ProRequestSource): Promise<SaveResult> {
  const existing = await findPending(shop, input.email);
  if (existing !== null) return keepOrUpdatePending(existing.id, input, source);
  if (source === "site" && (await countPendingProRequests(shop)) >= MAX_PENDING_REQUESTS) {
    return { ok: false, reason: "trop_de_demandes" };
  }
  try {
    const created = await prisma.proRequest.create({ data: { shop, source, ...fields(input) } });
    return { ok: true, id: created.id };
  } catch (error) {
    // Deux envois au même moment (clics répétés) : la base refuse le second (index unique), le premier reste.
    if (!isUniqueViolation(error)) throw error;
    const winner = await findPending(shop, input.email);
    if (winner === null) throw error;
    return keepOrUpdatePending(winner.id, input, source);
  }
}

export function countPendingProRequests(shop: string): Promise<number> {
  return prisma.proRequest.count({ where: { shop, status: "en_attente" } });
}

/**
 * Demandes à valider, dans l'ordre où elles sont arrivées : la plus récente en haut, comme « Toutes les commandes ».
 * L'identifiant départage deux demandes reçues à la même milliseconde : l'ordre ne change jamais d'un affichage à l'autre.
 */
export function listPendingProRequests(shop: string): Promise<ProRequest[]> {
  return prisma.proRequest.findMany({ where: { shop, status: "en_attente" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}

/** Dernières réponses, la plus récente en haut. */
export function listDecidedProRequests(shop: string, take = 10): Promise<ProRequest[]> {
  return prisma.proRequest.findMany({
    where: { shop, status: { not: "en_attente" } },
    orderBy: [{ decidedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
    take,
  });
}

export function getProRequest(shop: string, id: string): Promise<ProRequest | null> {
  return prisma.proRequest.findFirst({ where: { shop, id } });
}

/** Entreprise créée dans Shopify : notée tout de suite, pour qu'un nouvel essai ne la recrée pas. */
export async function rememberCompany(id: string, companyId: string): Promise<void> {
  await prisma.proRequest.update({ where: { id }, data: { companyId } });
}

export async function markProRequestAccepted(id: string, companyId: string, customerId: string): Promise<void> {
  await prisma.proRequest.update({ where: { id }, data: { status: "acceptee", companyId, customerId, decidedAt: new Date() } });
}

export async function markProRequestRefused(id: string): Promise<void> {
  await prisma.proRequest.update({ where: { id }, data: { status: "refusee", decidedAt: new Date() } });
}
