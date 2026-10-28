import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql } from "../shopify/graphql.server";
import { recordOrder } from "./idempotency.server";
import type { CompletedOrderNode } from "./mutations";
import { MESSAGES, type PhoneOrderOutcome } from "./outcome";
import { forOwner, livraisonMetafields } from "./payload";
import { DRAFT_ORDER_STATE_QUERY, type DraftOrderStateData } from "./queries";
import type { PhoneOrderInput } from "./types";
import { completeDraftOrder, setMetafields } from "./writes.server";

/**
 * Dernière étape : la provisoire devient une commande, puis les métachamps « livraison »
 * sont posés sur la commande (l'agenda les lit sur la commande, pas sur la provisoire).
 */

export interface DraftToFinish {
  readonly draftOrderId: string;
  readonly draftOrderName: string;
  readonly paymentPending: boolean;
}

/** Commande déjà créée à partir de cette provisoire (reprise après coupure), sinon `null`. */
async function existingOrder(admin: AdminApiContext, draftOrderId: string): Promise<CompletedOrderNode | null> {
  const state = await runAdminGraphql<DraftOrderStateData>(admin, DRAFT_ORDER_STATE_QUERY, { id: draftOrderId });
  return state.ok ? (state.value.draftOrder?.order ?? null) : null;
}

async function completeOnce(admin: AdminApiContext, draftOrderId: string): Promise<Result<CompletedOrderNode, ShopifyGraphqlError>> {
  const existing = await existingOrder(admin, draftOrderId);
  if (existing !== null) return success(existing);
  return completeDraftOrder(admin, draftOrderId);
}

function notCompletedMessage(draftName: string, error: ShopifyGraphqlError): string {
  const detail = error instanceof ShopifyUserErrors ? ` (${error.message})` : "";
  return `La commande n’est pas encore tout à fait enregistrée (${draftName}${detail}). Touchez à nouveau « Enregistrer la commande »\u202F: elle ne sera pas enregistrée deux fois.`;
}

export async function finishDraft(
  admin: AdminApiContext,
  order: PhoneOrderInput,
  draft: DraftToFinish,
  warnings: readonly string[],
): Promise<PhoneOrderOutcome> {
  const completed = await completeOnce(admin, draft.draftOrderId);
  if (!completed.ok) {
    logError("Commande provisoire non terminée", completed.error, { draftOrderId: draft.draftOrderId });
    return { kind: "erreur", message: notCompletedMessage(draft.draftOrderName, completed.error) };
  }
  const placed = completed.value;
  await recordOrder(order.idempotencyKey, { orderId: placed.id, orderName: placed.name });
  logInfo("Commande par téléphone créée", { orderId: placed.id, paymentPending: draft.paymentPending });

  const metafields = await setMetafields(admin, forOwner(placed.id, livraisonMetafields(order)));
  if (!metafields.ok) logError("Métachamps livraison non posés sur la commande", metafields.error, { orderId: placed.id });
  return {
    kind: "commande",
    orderId: placed.id,
    orderName: placed.name,
    paymentPending: draft.paymentPending,
    payment: order.payment,
    requestedDate: order.requestedDate,
    warnings: metafields.ok ? warnings : [...warnings, MESSAGES.metachampsNonPoses],
    replayed: false,
  };
}
