import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { ShopifyRequestError, type ShopifyGraphqlError } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import {
  DRAFT_ORDER_CALCULATE_MUTATION,
  DRAFT_ORDER_COMPLETE_MUTATION,
  DRAFT_ORDER_CREATE_MUTATION,
  METAFIELDS_SET_MUTATION,
  type CompletedOrderNode,
  type CreatedDraftOrderNode,
  type DraftOrderCalculateData,
  type DraftOrderCompleteData,
  type DraftOrderCreateData,
  type MetafieldsSetData,
} from "./mutations";
import type { DraftOrderInput, OrderMetafieldsSetInput } from "./payload";
import { readB2bPrices, type B2bPrices } from "./pricing";

/** Mutations Admin API de la commande par téléphone, chacune renvoyant un `Result`. */

export async function createDraftOrder(
  admin: AdminApiContext,
  input: DraftOrderInput,
): Promise<Result<CreatedDraftOrderNode, ShopifyGraphqlError>> {
  const result = await runAdminMutation(
    admin,
    DRAFT_ORDER_CREATE_MUTATION,
    (data: DraftOrderCreateData) => data.draftOrderCreate,
    { input },
  );
  if (!result.ok) return result;
  const draft = result.value.draftOrder;
  return draft === null ? failure(new ShopifyRequestError("Commande provisoire non créée")) : success(draft);
}

export async function completeDraftOrder(
  admin: AdminApiContext,
  draftOrderId: string,
): Promise<Result<CompletedOrderNode, ShopifyGraphqlError>> {
  const result = await runAdminMutation(
    admin,
    DRAFT_ORDER_COMPLETE_MUTATION,
    (data: DraftOrderCompleteData) => data.draftOrderComplete,
    { id: draftOrderId },
  );
  if (!result.ok) return result;
  const order = result.value.draftOrder?.order ?? null;
  return order === null ? failure(new ShopifyRequestError("Commande non créée à partir de la provisoire")) : success(order);
}

export async function setMetafields(
  admin: AdminApiContext,
  metafields: readonly OrderMetafieldsSetInput[],
): Promise<Result<true, ShopifyGraphqlError>> {
  const result = await runAdminMutation(
    admin,
    METAFIELDS_SET_MUTATION,
    (data: MetafieldsSetData) => data.metafieldsSet,
    { metafields },
  );
  return result.ok ? success(true) : result;
}

/** Prix du catalogue B2B, sans rien créer (`draftOrderCalculate`). */
export async function calculateDraftPrices(
  admin: AdminApiContext,
  input: DraftOrderInput,
): Promise<Result<B2bPrices, ShopifyGraphqlError>> {
  const result = await runAdminMutation(
    admin,
    DRAFT_ORDER_CALCULATE_MUTATION,
    (data: DraftOrderCalculateData) => data.draftOrderCalculate,
    { input },
  );
  if (!result.ok) return result;
  const calculated = result.value.calculatedDraftOrder;
  const prices = calculated === null ? null : readB2bPrices(calculated);
  return prices === null ? failure(new ShopifyRequestError("Prix B2B illisibles")) : success(prices);
}
