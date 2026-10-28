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

/** Une seule demande en attente par e-mail : renvoyer le formulaire met la demande à jour. */
export async function saveProRequest(shop: string, input: ProRequestInput, source: ProRequestSource): Promise<SaveResult> {
  const existing = await prisma.proRequest.findFirst({ where: { shop, status: "en_attente", email: input.email } });
  if (existing !== null) {
    await prisma.proRequest.update({ where: { id: existing.id }, data: fields(input) });
    return { ok: true, id: existing.id };
  }
  if (source === "site" && (await countPendingProRequests(shop)) >= MAX_PENDING_REQUESTS) {
    return { ok: false, reason: "trop_de_demandes" };
  }
  const created = await prisma.proRequest.create({ data: { shop, source, ...fields(input) } });
  return { ok: true, id: created.id };
}

export function countPendingProRequests(shop: string): Promise<number> {
  return prisma.proRequest.count({ where: { shop, status: "en_attente" } });
}

export function listPendingProRequests(shop: string): Promise<ProRequest[]> {
  return prisma.proRequest.findMany({ where: { shop, status: "en_attente" }, orderBy: { createdAt: "asc" } });
}

export function listDecidedProRequests(shop: string, take = 10): Promise<ProRequest[]> {
  return prisma.proRequest.findMany({ where: { shop, status: { not: "en_attente" } }, orderBy: { decidedAt: "desc" }, take });
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
