import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { formatChf } from "../format/money";
import { ShopifyUserErrors } from "../shopify/errors";
import { runAdminMutation } from "../shopify/graphql.server";
import { parseGid } from "../shopify/ids";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import { centsToMoney, parsePrice, type PriceResult } from "./price";

/** Change le prix d'un vin dans Shopify (Admin API, `write_products`). */

const PRICE_MUTATION = `#graphql
mutation ModifierPrix($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price }
    userErrors { field message }
  }
}`;

interface PriceData {
  readonly productVariantsBulkUpdate: {
    readonly productVariants: readonly { readonly id: string; readonly price: string }[] | null;
    readonly userErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[];
  } | null;
}

export async function handlePriceChange(admin: AdminApiContext, form: FormData): Promise<PriceResult> {
  const rawVariant = form.get("variantId");
  const rawProduct = form.get("productId");
  const rawPrice = form.get("price");
  const variantId = typeof rawVariant === "string" ? rawVariant : "";
  const variant = parseGid(variantId, "ProductVariant");
  const product = typeof rawProduct === "string" ? parseGid(rawProduct, "Product") : null;
  if (variant === null || product === null || typeof rawPrice !== "string") {
    return { ok: false, variantId, message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };
  }
  const price = parsePrice(rawPrice);
  if (!price.ok) return { ok: false, variantId, message: price.message };
  const changed = await runAdminMutation(admin, PRICE_MUTATION, (data: PriceData) => data.productVariantsBulkUpdate, {
    productId: product,
    variants: [{ id: variant, price: centsToMoney(price.cents) }],
  });
  if (!changed.ok) {
    logError("Prix non changé", changed.error, { variantId });
    const plain = changed.error instanceof ShopifyUserErrors ? plainShopifyRefusal(changed.error.message) : null;
    const denied = /access denied|access scope/i.test(changed.error.message);
    return {
      ok: false,
      variantId,
      message: plain ?? (denied ? "L’app n’a pas le droit de changer les prix. Contactez la personne qui l’a installée." : "Le prix n’a pas pu être changé. Réessayez dans un instant."),
    };
  }
  logInfo("Prix changé", { variantId, cents: price.cents });
  return { ok: true, variantId, message: `C’est noté : le prix est maintenant de ${formatChf(price.cents)}.` };
}
