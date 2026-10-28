/**
 * Anti-doublon de la commande par téléphone : que faire quand la clé envoyée
 * par le navigateur a déjà été vue ? Logique pure, la base est dans idempotency.server.ts.
 */

export const REQUEST_STATUSES = ["en_cours", "a_terminer", "terminee", "brouillon"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** Au-delà, une saisie restée « en cours » est considérée comme abandonnée (serveur coupé). */
export const STALE_AFTER_MS = 2 * 60 * 1000;

export interface StoredRequest {
  readonly shop: string;
  readonly status: string;
  readonly draftOrderId: string | null;
  readonly draftOrderName: string | null;
  readonly orderId: string | null;
  readonly orderName: string | null;
  readonly paymentPending: boolean;
  readonly updatedAt: Date;
}

export type ReplayDecision =
  /** Une autre requête travaille sur cette clé en ce moment. */
  | { readonly kind: "en_cours" }
  /** Saisie abandonnée sans commande provisoire : on peut la reprendre de zéro. */
  | { readonly kind: "reprendre" }
  | { readonly kind: "terminer"; readonly draftOrderId: string; readonly draftOrderName: string; readonly paymentPending: boolean }
  | { readonly kind: "deja_terminee"; readonly orderId: string; readonly orderName: string; readonly paymentPending: boolean }
  | { readonly kind: "brouillon"; readonly draftOrderId: string; readonly draftOrderName: string }
  /** Clé inconnue pour cette boutique, ou ligne incohérente. */
  | { readonly kind: "refusee" };

function isStale(request: StoredRequest, now: Date): boolean {
  return now.getTime() - request.updatedAt.getTime() > STALE_AFTER_MS;
}

export function decideReplay(request: StoredRequest, shop: string, now: Date): ReplayDecision {
  if (request.shop !== shop) return { kind: "refusee" };
  const { draftOrderId, draftOrderName, orderId, orderName, paymentPending } = request;
  if (orderId !== null && orderName !== null) return { kind: "deja_terminee", orderId, orderName, paymentPending };
  if (request.status === "en_cours") return isStale(request, now) ? { kind: "reprendre" } : { kind: "en_cours" };
  if (draftOrderId === null || draftOrderName === null) return { kind: "refusee" };
  if (request.status === "brouillon") return { kind: "brouillon", draftOrderId, draftOrderName };
  if (request.status === "a_terminer") return { kind: "terminer", draftOrderId, draftOrderName, paymentPending };
  return { kind: "refusee" };
}
