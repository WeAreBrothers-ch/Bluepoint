import { parseGid } from "../shopify/ids";
import type { VariantNode } from "./queries";
import { decimalToCents, productLabel } from "./totals";
import type { ProductOption } from "./types";

/** Catalogue de la saisie par téléphone : réponse GraphQL → produits affichés, et filtre rapide. */

/** `null` si l'identifiant ou le prix est illisible : la variante n'est pas proposée. */
export function toProductOption(node: VariantNode): ProductOption | null {
  const variantId = parseGid(node.id, "ProductVariant");
  const priceCents = decimalToCents(node.price);
  if (variantId === null || priceCents === null) return null;
  const image = node.product.featuredMedia?.preview?.image ?? null;
  const tracked = node.inventoryItem?.tracked ?? false;
  const sku = node.sku?.trim();
  return {
    variantId,
    productTitle: node.product.title,
    variantTitle: node.product.hasOnlyDefaultVariant ? null : node.title,
    sku: sku === undefined || sku === "" ? null : sku,
    priceCents,
    available: tracked ? (node.inventoryQuantity ?? 0) : null,
    imageUrl: image?.url ?? null,
    imageAlt: image?.altText?.trim() || node.product.title,
  };
}

export function toProductOptions(nodes: readonly VariantNode[]): ProductOption[] {
  return nodes.flatMap((node) => {
    const option = toProductOption(node);
    return option === null ? [] : [option];
  });
}

/** Minuscules sans accents : « Rosé » se trouve en tapant « rose ». */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr-CH").trim();
}

/** Filtre rapide : chaque mot saisi doit apparaître dans le nom, la variante ou le SKU. */
export function filterProducts(products: readonly ProductOption[], raw: string): readonly ProductOption[] {
  const words = normalizeSearch(raw).split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return products;
  return products.filter((product) => {
    const haystack = normalizeSearch(`${productLabel(product)} ${product.sku ?? ""}`);
    return words.every((word) => haystack.includes(word));
  });
}
