import type { Bottle } from "@/data/types";

/** Formats proposés à l'achat. Aucune remise inventée : le prix est unitaire × quantité. */
export const PACK_SIZES = [1, 3, 6, 12] as const;
export type PackSize = (typeof PACK_SIZES)[number];

/** Promesse réelle du site actuel. */
export const FREE_SHIPPING_FROM = 24;

export function packLabel(size: PackSize): string {
  return size === 1 ? "1 bouteille" : `Carton de ${size}`;
}

export function packPriceCents(bottle: Bottle, size: PackSize): number {
  return bottle.priceCents * size;
}

export function isPackSize(value: number): value is PackSize {
  return (PACK_SIZES as ReadonlyArray<number>).includes(value);
}
