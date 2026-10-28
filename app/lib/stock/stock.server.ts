import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { success, type Result } from "../core/result";
import { ShopifyUserErrors, type ShopifyRequestError } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { collectPages, type Page } from "../shopify/paginate";
import { grantedScopes } from "../shopify/access.server";
import { NEW_WINE_SCOPES } from "./new-wine.server";
import {
  parseStockChange,
  STALE_STOCK_MESSAGE,
  STOCK_MAX_VARIANTS,
  STOCK_PAGE_SIZE,
  STOCK_QUERY,
  stockChangeMessage,
  toStockItem,
  type StockActionResult,
  type StockChange,
  type StockData,
  type StockItem,
  type StockVariantNode,
} from "./stock";

/** Page Stock : lecture du stock des vins et changements (bouteilles reçues, comptage de la cave). */

export const STOCK_WRITE_SCOPE = "write_inventory";

export interface StockPageData {
  readonly items: readonly StockItem[];
  readonly truncated: boolean;
  readonly loadError: string | null;
  /** `false` : l'autorisation de changer le stock n'a pas encore été donnée à l'app. */
  readonly canEdit: boolean;
  /** `false` : l'autorisation de créer des vins n'a pas encore été donnée à l'app. */
  readonly canCreateWines: boolean;
}

function stockPage(admin: AdminApiContext) {
  return async (after: string | null, first: number): Promise<Result<Page<StockVariantNode>, ShopifyRequestError>> => {
    const result = await runAdminGraphql<StockData>(admin, STOCK_QUERY, { first, after });
    if (!result.ok) return result;
    const { nodes, pageInfo } = result.value.productVariants;
    return success({ items: nodes, hasNextPage: pageInfo.hasNextPage, endCursor: pageInfo.endCursor });
  };
}

export async function loadStockPage(admin: AdminApiContext): Promise<StockPageData> {
  const [pages, scopes] = await Promise.all([collectPages(stockPage(admin), STOCK_PAGE_SIZE, STOCK_MAX_VARIANTS), grantedScopes(admin)]);
  // Autorisations illisibles : on laisse essayer, Shopify refusera au besoin avec un message clair.
  const canEdit = scopes === null || scopes.has(STOCK_WRITE_SCOPE);
  const canCreateWines = scopes === null || NEW_WINE_SCOPES.every((scope) => scopes.has(scope));
  if (!pages.ok) {
    logError("Stock illisible", pages.error);
    const loadError = "Shopify ne répond pas pour le moment. Rechargez la page dans un instant.";
    return { items: [], truncated: false, loadError, canEdit, canCreateWines };
  }
  return { items: pages.value.items.map(toStockItem), truncated: pages.value.truncated, loadError: null, canEdit, canCreateWines };
}

const ADJUST_MUTATION = `#graphql
mutation AjouterBouteilles($input: InventoryAdjustQuantitiesInput!, $key: String!) {
  inventoryAdjustQuantities(input: $input) @idempotent(key: $key) {
    inventoryAdjustmentGroup { changes { name quantityAfterChange } }
    userErrors { field message code }
  }
}`;

const SET_MUTATION = `#graphql
mutation CorrigerStock($input: InventorySetQuantitiesInput!, $key: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $key) {
    inventoryAdjustmentGroup { changes { name quantityAfterChange } }
    userErrors { field message code }
  }
}`;

interface ChangePayload {
  readonly inventoryAdjustmentGroup: {
    readonly changes: readonly { readonly name: string; readonly quantityAfterChange: number | null }[];
  } | null;
  readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string; readonly code: string | null }[];
}

/** Bouteilles reçues : « disponible » augmente. Réserve et comptage : la cave (« on_hand ») est fixée. */
function runChange(admin: AdminApiContext, change: StockChange) {
  const place = { inventoryItemId: change.inventoryItemId, locationId: change.locationId, changeFromQuantity: change.expected };
  if (change.intent === "ajouter") {
    return runAdminMutation(admin, ADJUST_MUTATION, (data: { readonly inventoryAdjustQuantities: ChangePayload }) => data.inventoryAdjustQuantities, {
      key: change.key,
      input: { name: "available", reason: "received", changes: [{ ...place, delta: change.quantity }] },
    });
  }
  return runAdminMutation(admin, SET_MUTATION, (data: { readonly inventorySetQuantities: ChangePayload }) => data.inventorySetQuantities, {
    key: change.key,
    input: { name: "on_hand", reason: "correction", quantities: [{ ...place, quantity: change.quantity }] },
  });
}

const STALE_CODES = new Set(["CHANGE_FROM_QUANTITY_STALE", "COMPARE_QUANTITY_STALE"]);

export async function handleStockAction(admin: AdminApiContext, form: FormData): Promise<StockActionResult> {
  const parsed = parseStockChange(form);
  if (!parsed.ok) return parsed;
  const { change } = parsed;
  const result = await runChange(admin, change);
  if (!result.ok) {
    const stale = result.error instanceof ShopifyUserErrors && result.error.userErrors.some((error) => STALE_CODES.has(error.code ?? ""));
    if (stale) return { ok: false, inventoryItemId: change.inventoryItemId, message: STALE_STOCK_MESSAGE };
    logError("Stock non changé", result.error, { intent: change.intent, inventoryItemId: change.inventoryItemId });
    const denied = /access denied|access scope/i.test(result.error.message);
    const message = denied
      ? "L’app n’a pas encore le droit de changer le stock. Il faut d’abord faire l’étape d’autorisation (cadre jaune en haut de la page)."
      : "Shopify n’a pas pu changer le stock. Rechargez la page, puis réessayez.";
    return { ok: false, inventoryItemId: change.inventoryItemId, message };
  }
  const target = change.intent === "ajouter" ? "available" : "on_hand";
  const after = result.value.inventoryAdjustmentGroup?.changes.find((entry) => entry.name === target)?.quantityAfterChange ?? null;
  logInfo("Stock changé", { intent: change.intent, inventoryItemId: change.inventoryItemId, quantity: change.quantity, after });
  return { ok: true, inventoryItemId: change.inventoryItemId, message: stockChangeMessage(change, after) };
}
