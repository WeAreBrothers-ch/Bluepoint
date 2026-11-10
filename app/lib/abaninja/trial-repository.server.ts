import prisma from "../../db.server";
import { failure, success, toError, type Result } from "../core/result";
import { claimInvoiceSlot } from "./repository.server";
import type { AbaNinjaInvoice, ClaimOutcome } from "./repository-types";

/**
 * Accès base de l'essai de connexion. Les lignes d'essai sont des factures
 * normales marquées isTest, dont l'identifiant de commande commence par « essai- ».
 */

const TRIAL_ORDER_PREFIX = "essai-";

/** Un essai par minute et par boutique : l'identifiant change à chaque minute, la base refuse le doublon. */
export function trialOrderId(shop: string, now: Date): string {
  return `${TRIAL_ORDER_PREFIX}${shop}-${Math.floor(now.getTime() / 60_000)}`;
}

export async function findLatestTrial(shop: string): Promise<Result<AbaNinjaInvoice | null, Error>> {
  try {
    const latest = await prisma.abaNinjaInvoice.findFirst({
      where: { shop, isTest: true, orderId: { startsWith: TRIAL_ORDER_PREFIX } },
      orderBy: { createdAt: "desc" },
    });
    return success(latest);
  } catch (thrown) {
    return failure(toError(thrown));
  }
}

/** Prend le verrou de l'essai ; `claimed: false` veut dire qu'un essai a déjà démarré dans cette minute. */
export function claimTrialSlot(shop: string, reference: string, now: Date): Promise<Result<ClaimOutcome, Error>> {
  return claimInvoiceSlot({
    shop,
    orderId: trialOrderId(shop, now),
    orderName: "Essai de connexion",
    reference,
    isTest: true,
  });
}
