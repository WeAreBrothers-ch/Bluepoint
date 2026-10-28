import type { DeliveryOrderState } from "./operations";

/**
 * Ce qu'il reste à faire pour qu'une commande soit « livrée » dans Shopify.
 * Fonction pure : la rejouer sur une commande déjà livrée ne produit aucune action (idempotence).
 */

export type DeliveryPlan =
  | { readonly kind: "deja_livree" }
  | { readonly kind: "bloquee"; readonly reason: "annulee" | "en_attente" | "rien_a_expedier" }
  | {
      readonly kind: "a_faire";
      /** Ordres d'expédition à expédier maintenant (une expédition chacun). */
      readonly fulfillmentOrderIds: readonly string[];
      /** Expéditions existantes à marquer « livrée ». */
      readonly fulfillmentIdsToDeliver: readonly string[];
    };

const FULFILLABLE_STATUSES = new Set(["OPEN", "IN_PROGRESS"]);
const WAITING_STATUSES = new Set(["ON_HOLD", "SCHEDULED", "INCOMPLETE"]);
const DELIVERED_DISPLAY = new Set(["DELIVERED", "PICKED_UP"]);

export function planDelivery(order: DeliveryOrderState): DeliveryPlan {
  if (order.cancelledAt !== null) return { kind: "bloquee", reason: "annulee" };
  const orders = order.fulfillmentOrders.nodes;
  const fulfillmentOrderIds = orders
    .filter((fo) => FULFILLABLE_STATUSES.has(fo.status) && fo.supportedActions.some((a) => a.action === "CREATE_FULFILLMENT"))
    .map((fo) => fo.id);
  const active = order.fulfillments.filter((f) => f.status === "SUCCESS");
  const fulfillmentIdsToDeliver = active
    .filter((f) => f.displayStatus === null || !DELIVERED_DISPLAY.has(f.displayStatus))
    .map((f) => f.id);
  if (fulfillmentOrderIds.length > 0 || fulfillmentIdsToDeliver.length > 0) {
    return { kind: "a_faire", fulfillmentOrderIds, fulfillmentIdsToDeliver };
  }
  if (orders.some((fo) => WAITING_STATUSES.has(fo.status))) return { kind: "bloquee", reason: "en_attente" };
  if (active.length > 0) return { kind: "deja_livree" };
  return { kind: "bloquee", reason: "rien_a_expedier" };
}
