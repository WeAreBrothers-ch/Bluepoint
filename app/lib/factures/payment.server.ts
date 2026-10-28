import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import type { ShopifyGraphqlError, ShopifyRequestError } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { paymentMethodTag, type PaymentMethod } from "./payment";

/** Statut de paiement des commandes facturées, et « C'est payé » (Admin API, vérifié sur le schéma 2026-10). */

const STATUS_BATCH = 100;

const ORDER_STATUSES_QUERY = `#graphql
query StatutsPaiement($ids: [ID!]!) {
  nodes(ids: $ids) { ... on Order { id displayFinancialStatus } }
}`;

interface OrderStatusesData {
  readonly nodes: readonly ({ readonly id?: string; readonly displayFinancialStatus?: string | null } | null)[];
}

/** Statut de paiement Shopify par identifiant de commande (absent si la commande est introuvable). */
export async function loadPaymentStatuses(
  admin: AdminApiContext,
  orderIds: readonly string[],
): Promise<Result<Map<string, string | null>, ShopifyRequestError>> {
  const statuses = new Map<string, string | null>();
  for (let start = 0; start < orderIds.length; start += STATUS_BATCH) {
    const ids = orderIds.slice(start, start + STATUS_BATCH);
    const result = await runAdminGraphql<OrderStatusesData>(admin, ORDER_STATUSES_QUERY, { ids });
    if (!result.ok) return failure(result.error);
    for (const node of result.value.nodes) {
      if (node?.id !== undefined) statuses.set(node.id, node.displayFinancialStatus ?? null);
    }
  }
  return success(statuses);
}

const MARK_PAID_MUTATION = `#graphql
mutation CommandePayee($input: OrderMarkAsPaidInput!) {
  orderMarkAsPaid(input: $input) {
    order { id displayFinancialStatus }
    userErrors { field message }
  }
}`;

interface MarkPaidData {
  readonly orderMarkAsPaid: {
    readonly order: { readonly id: string; readonly displayFinancialStatus: string | null } | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}

const TAGS_ADD_MUTATION = `#graphql
mutation EtiquettePaiement($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    userErrors { field message }
  }
}`;

interface TagsAddData {
  readonly tagsAdd: { readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[] } | null;
}

/**
 * Enregistre le paiement dans Shopify (transaction du montant restant), puis note le moyen
 * de paiement en étiquette. L'étiquette est un plus : son échec n'annule pas le paiement.
 */
export async function markOrderPaid(
  admin: AdminApiContext,
  orderId: string,
  method: PaymentMethod,
): Promise<Result<true, ShopifyGraphqlError>> {
  const paid = await runAdminMutation(admin, MARK_PAID_MUTATION, (data: MarkPaidData) => data.orderMarkAsPaid, {
    input: { id: orderId },
  });
  if (!paid.ok) return paid;
  const tagged = await runAdminMutation(admin, TAGS_ADD_MUTATION, (data: TagsAddData) => data.tagsAdd, {
    id: orderId,
    tags: [paymentMethodTag(method)],
  });
  if (!tagged.ok) logError("Moyen de paiement non noté sur la commande", tagged.error, { orderId, method });
  logInfo("Commande notée payée", { orderId, method });
  return success(true);
}
