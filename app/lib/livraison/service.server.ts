import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import type { OrderGid } from "../shopify/ids";
import { DeliveryError } from "./errors";
import {
  DELIVERY_STATE_QUERY,
  FULFILLMENT_CREATE_MUTATION,
  FULFILLMENT_EVENT_CREATE_MUTATION,
  type DeliveryStateData,
  type FulfillmentCreateData,
  type FulfillmentEventCreateData,
} from "./operations";
import { planDelivery } from "./plan";

/**
 * « Marquer livrée » : (a) expédie ce qui ne l'est pas encore, (b) marque chaque expédition
 * « livrée ». Relancer l'opération sur une commande déjà livrée ne fait rien (idempotent).
 */

export interface DeliveryOptions {
  /** Envoyer l'e-mail d'expédition de Shopify au client (désactivé par défaut). */
  readonly notifyCustomer: boolean;
}

export interface DeliveryOutcome {
  readonly alreadyDelivered: boolean;
  readonly createdFulfillments: number;
}

function toDeliveryError(error: ShopifyGraphqlError): DeliveryError {
  return error instanceof ShopifyUserErrors
    ? new DeliveryError("shopify_refus", error.message)
    : new DeliveryError("shopify_indisponible");
}

async function createFulfillment(
  admin: AdminApiContext,
  fulfillmentOrderId: string,
  notifyCustomer: boolean,
): Promise<Result<string, DeliveryError>> {
  const result = await runAdminMutation(
    admin,
    FULFILLMENT_CREATE_MUTATION,
    (data: FulfillmentCreateData) => data.fulfillmentCreate,
    { fulfillment: { notifyCustomer, lineItemsByFulfillmentOrder: [{ fulfillmentOrderId }] } },
  );
  if (!result.ok) return failure(toDeliveryError(result.error));
  const id = result.value.fulfillment?.id;
  return id === undefined ? failure(new DeliveryError("shopify_refus", "Expédition non créée.")) : success(id);
}

async function markDelivered(admin: AdminApiContext, fulfillmentId: string): Promise<Result<true, DeliveryError>> {
  const result = await runAdminMutation(
    admin,
    FULFILLMENT_EVENT_CREATE_MUTATION,
    (data: FulfillmentEventCreateData) => data.fulfillmentEventCreate,
    { fulfillmentEvent: { fulfillmentId, status: "DELIVERED", happenedAt: new Date().toISOString() } },
  );
  return result.ok ? success(true) : failure(toDeliveryError(result.error));
}

const BLOCKED_CODES = {
  annulee: "commande_annulee",
  en_attente: "expedition_bloquee",
  rien_a_expedier: "rien_a_expedier",
} as const;

export async function markOrderDelivered(
  admin: AdminApiContext,
  orderId: OrderGid,
  options: DeliveryOptions,
): Promise<Result<DeliveryOutcome, DeliveryError>> {
  const state = await runAdminGraphql<DeliveryStateData>(admin, DELIVERY_STATE_QUERY, { id: orderId });
  if (!state.ok) {
    logError("Lecture de l'état de livraison impossible", state.error, { orderId });
    return failure(new DeliveryError("shopify_indisponible"));
  }
  if (state.value.order === null) return failure(new DeliveryError("commande_introuvable"));
  const plan = planDelivery(state.value.order);
  if (plan.kind === "deja_livree") return success({ alreadyDelivered: true, createdFulfillments: 0 });
  if (plan.kind === "bloquee") return failure(new DeliveryError(BLOCKED_CODES[plan.reason]));

  const toDeliver = [...plan.fulfillmentIdsToDeliver];
  for (const fulfillmentOrderId of plan.fulfillmentOrderIds) {
    const created = await createFulfillment(admin, fulfillmentOrderId, options.notifyCustomer);
    if (!created.ok) return created;
    toDeliver.push(created.value);
  }
  for (const fulfillmentId of toDeliver) {
    const delivered = await markDelivered(admin, fulfillmentId);
    if (!delivered.ok) return delivered;
  }
  logInfo("Commande marquée livrée", { orderId, expeditions: plan.fulfillmentOrderIds.length });
  return success({ alreadyDelivered: false, createdFulfillments: plan.fulfillmentOrderIds.length });
}
