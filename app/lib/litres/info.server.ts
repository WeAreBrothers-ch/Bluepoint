import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminGraphql, runAdminMutation } from "../shopify/graphql.server";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { parseWineInfoForm, type WineInfoResult } from "./info-form";
import { withWineTags } from "./wine-info";

/** Enregistre le pays, la contenance, l'année ou l'appellation d'un vin dans ses étiquettes Shopify (`write_products`). */

const TAGS_QUERY = `#graphql
query EtiquettesDuVin($id: ID!) { product(id: $id) { title tags } }`;

const UPDATE_MUTATION = `#graphql
mutation CompleterLeVin($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id }
    userErrors { field message }
  }
}`;

interface TagsData {
  readonly product: { readonly title: string; readonly tags: readonly string[] } | null;
}

interface UpdateData {
  readonly productUpdate: {
    readonly product: { readonly id: string } | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}

export async function handleWineInfo(admin: AdminApiContext, form: FormData): Promise<WineInfoResult> {
  const parsed = parseWineInfoForm(form);
  if (!parsed.ok) return parsed;
  const { productId, changes } = parsed;
  // Les étiquettes sont relues juste avant : on ne remplace que celles qu'on change, jamais celles qu'un autre vient d'ajouter.
  const current = await runAdminGraphql<TagsData>(admin, TAGS_QUERY, { id: productId });
  if (!current.ok) {
    logError("Infos du vin : étiquettes illisibles", current.error, { productId });
    return { ok: false, productId, message: "Shopify ne répond pas pour le moment. Réessayez dans un instant." };
  }
  if (current.value.product === null) return { ok: false, productId, message: "Ce vin n’existe plus." };
  const { title, tags } = current.value.product;
  const updated = await runAdminMutation(admin, UPDATE_MUTATION, (data: UpdateData) => data.productUpdate, {
    product: { id: productId, tags: withWineTags(tags, changes) },
  });
  if (!updated.ok) {
    logError("Infos du vin non enregistrées", updated.error, { productId });
    const plain = updated.error instanceof ShopifyUserErrors ? plainShopifyRefusal(updated.error.message) : null;
    const denied = /access denied|access scope/i.test(updated.error.message);
    return {
      ok: false,
      productId,
      message: plain ?? (denied ? "L’app n’a pas le droit de modifier les vins. Contactez la personne qui l’a installée." : "Les informations n’ont pas pu être enregistrées. Réessayez dans un instant."),
    };
  }
  logInfo("Infos du vin enregistrées", { productId, fields: Object.keys(changes).join(",") });
  return { ok: true, productId, message: `C’est noté pour « ${title} ».` };
}
