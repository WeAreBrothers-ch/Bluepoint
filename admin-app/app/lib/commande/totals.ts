import type { PhoneOrderLine, ProductOption, VariantGid } from "./types";

/** Totaux et alertes de stock de la commande, calculés en centimes (jamais en virgule flottante). */

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Montant Shopify (« 24.5 », « 24.50 ») → centimes. `null` si illisible. */
export function decimalToCents(value: string | null | undefined): number | null {
  const parts = DECIMAL.exec(value?.trim() ?? "");
  if (parts === null) return null;
  const [, sign = "", francs = "0", decimals = ""] = parts;
  const rappen = Number(decimals.padEnd(2, "0").slice(0, 2));
  const roundUp = Number(decimals.charAt(2) || "0") >= 5 ? 1 : 0;
  const cents = Number(francs) * 100 + rappen + roundUp;
  return Number.isSafeInteger(cents) ? (sign === "-" ? -cents : cents) : null;
}

export interface TotalLine {
  readonly variantId: VariantGid;
  readonly label: string;
  readonly quantity: number;
  readonly unitCents: number;
  readonly totalCents: number;
}

export interface OrderTotals {
  readonly lines: readonly TotalLine[];
  readonly totalQuantity: number;
  readonly subtotalCents: number;
}

/** Libellé d'une variante : « Produit — Variante », ou le produit seul. */
export function productLabel(product: Pick<ProductOption, "productTitle" | "variantTitle">): string {
  return product.variantTitle === null ? product.productTitle : `${product.productTitle} — ${product.variantTitle}`;
}

/**
 * Totaux de la commande. `unitOverrides` : prix unitaires calculés par Shopify (catalogue B2B) ;
 * à défaut, le prix de la variante. Les lignes d'un produit inconnu sont ignorées.
 */
export function computeTotals(
  lines: readonly PhoneOrderLine[],
  products: readonly ProductOption[],
  unitOverrides: ReadonlyMap<string, number> = new Map(),
): OrderTotals {
  const byId = new Map(products.map((product) => [product.variantId as string, product]));
  const totalLines: TotalLine[] = [];
  for (const line of lines) {
    const product = byId.get(line.variantId);
    if (product === undefined || line.quantity <= 0) continue;
    const unitCents = unitOverrides.get(line.variantId) ?? product.priceCents;
    totalLines.push({
      variantId: line.variantId,
      label: productLabel(product),
      quantity: line.quantity,
      unitCents,
      totalCents: unitCents * line.quantity,
    });
  }
  return {
    lines: totalLines,
    totalQuantity: totalLines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: totalLines.reduce((sum, line) => sum + line.totalCents, 0),
  };
}

export interface StockWarning {
  readonly variantId: VariantGid;
  readonly label: string;
  readonly requested: number;
  readonly available: number;
}

/** Quantité demandée supérieure au stock disponible : on prévient, on ne bloque pas. */
export function isOverStock(product: Pick<ProductOption, "available">, quantity: number): boolean {
  return product.available !== null && quantity > product.available;
}

export function stockWarnings(lines: readonly PhoneOrderLine[], products: readonly ProductOption[]): StockWarning[] {
  const byId = new Map(products.map((product) => [product.variantId as string, product]));
  return lines.flatMap((line) => {
    const product = byId.get(line.variantId);
    if (product === undefined || product.available === null || !isOverStock(product, line.quantity)) return [];
    return [{ variantId: line.variantId, label: productLabel(product), requested: line.quantity, available: product.available }];
  });
}
