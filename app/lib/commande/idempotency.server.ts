import { Prisma } from "@prisma/client";
import prisma from "../../db.server";
import { decideReplay, type ReplayDecision } from "./idempotency";

/**
 * Suivi des saisies en base (table PhoneOrderRequest). La clé primaire garantit qu'une
 * seule requête « prend » une clé : la seconde (double clic) lit l'état de la première.
 */

export type ClaimResult = { readonly kind: "nouvelle" } | ReplayDecision;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Reprend une saisie abandonnée, sauf si une autre requête l'a reprise entre-temps. */
async function takeOver(key: string, seenUpdatedAt: Date): Promise<ClaimResult> {
  const taken = await prisma.phoneOrderRequest.updateMany({
    where: { key, status: "en_cours", updatedAt: seenUpdatedAt },
    data: { updatedAt: new Date() },
  });
  return taken.count === 1 ? { kind: "nouvelle" } : { kind: "en_cours" };
}

export async function claimRequest(shop: string, key: string): Promise<ClaimResult> {
  try {
    await prisma.phoneOrderRequest.create({ data: { key, shop } });
    return { kind: "nouvelle" };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  const existing = await prisma.phoneOrderRequest.findUnique({ where: { key } });
  if (existing === null) return { kind: "en_cours" };
  const decision = decideReplay(existing, shop, new Date());
  return decision.kind === "reprendre" ? takeOver(key, existing.updatedAt) : decision;
}

export interface DraftRecord {
  readonly draftOrderId: string;
  readonly draftOrderName: string;
  /** a_terminer : la commande doit encore être terminée ; brouillon : laissée provisoire exprès. */
  readonly status: "a_terminer" | "brouillon";
  readonly paymentPending: boolean;
}

export async function recordDraft(key: string, draft: DraftRecord): Promise<void> {
  await prisma.phoneOrderRequest.update({ where: { key }, data: draft });
}

export async function recordOrder(key: string, order: { readonly orderId: string; readonly orderName: string }): Promise<void> {
  await prisma.phoneOrderRequest.update({ where: { key }, data: { ...order, status: "terminee" } });
}

/** Rien n'a été créé chez Shopify : la clé est libérée pour un nouvel essai. */
export async function releaseRequest(key: string): Promise<void> {
  await prisma.phoneOrderRequest.deleteMany({ where: { key, status: "en_cours" } });
}
