import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { PAS_ENCORE_ACTIVE } from "../titres";
import { findPlaces } from "./new-wine.server";
import { parseRetire, retireMessage, type RetiredWine, type RetireResult } from "./retire";

/** Retirer un vin de la vente (archivé dans Shopify, jamais effacé) ou le remettre en vente (`write_products`). */

const STATUS_MUTATION = `#graphql
mutation StatutDuVin($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id status }
    userErrors { field message }
  }
}`;

const PUBLISH_MUTATION = `#graphql
mutation RemettreSurLeSite($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    userErrors { field message }
  }
}`;

const RETIRED_QUERY = `#graphql
query VinsRetires {
  products(first: 100, query: "status:archived", sortKey: TITLE) {
    nodes { id title featuredMedia { preview { image { url } } } }
  }
}`;

interface StatusData {
  readonly productUpdate: {
    readonly product: { readonly id: string; readonly status: string } | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}

interface PublishData {
  readonly publishablePublish: { readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[] } | null;
}

interface RetiredData {
  readonly products: {
    readonly nodes: readonly {
      readonly id: string;
      readonly title: string;
      readonly featuredMedia: { readonly preview: { readonly image: { readonly url: string } | null } | null } | null;
    }[];
  };
}

/** Les vins retirés de la vente, pour pouvoir les remettre. Liste vide si Shopify ne répond pas. */
export async function loadRetiredWines(admin: AdminApiContext): Promise<RetiredWine[]> {
  const result = await runAdminGraphql<RetiredData>(admin, RETIRED_QUERY);
  if (!result.ok) {
    logError("Vins retirés illisibles", result.error);
    return [];
  }
  return result.value.products.nodes.map((node) => ({
    productId: node.id,
    title: node.title,
    imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
  }));
}

/** Remis en vente, le vin revient sur le site : mêmes canaux de vente que les autres vins. */
async function publishLikeOthers(admin: AdminApiContext, productId: string, title: string): Promise<void> {
  const places = await findPlaces(admin, title);
  if (places === null || places.publicationIds.length === 0) return;
  const published = await runAdminMutation(admin, PUBLISH_MUTATION, (data: PublishData) => data.publishablePublish, {
    id: productId,
    input: places.publicationIds.map((publicationId) => ({ publicationId })),
  });
  if (!published.ok) logError("Vin remis en vente mais pas sur le site", published.error, { productId });
}

export async function handleRetire(admin: AdminApiContext, form: FormData): Promise<RetireResult> {
  const parsed = parseRetire(form);
  if (!parsed.ok) return { ok: false, intent: parsed.intent, message: parsed.message };
  const { intent, productId, title } = parsed;
  const changed = await runAdminMutation(admin, STATUS_MUTATION, (data: StatusData) => data.productUpdate, {
    product: { id: productId, status: intent === "retirer" ? "ARCHIVED" : "ACTIVE" },
  });
  if (!changed.ok) {
    logError(intent === "retirer" ? "Vin non retiré de la vente" : "Vin non remis en vente", changed.error, { productId });
    const plain = changed.error instanceof ShopifyUserErrors ? plainShopifyRefusal(changed.error.message) : null;
    const denied = /access denied|access scope/i.test(changed.error.message);
    return { ok: false, intent, message: plain ?? (denied ? PAS_ENCORE_ACTIVE : "Ça n’a pas marché. Réessayez dans un instant : rien n’a été changé.") };
  }
  if (intent === "remettre") await publishLikeOthers(admin, productId, title);
  logInfo(intent === "retirer" ? "Vin retiré de la vente" : "Vin remis en vente", { productId });
  return { ok: true, intent, message: retireMessage(intent, title) };
}
