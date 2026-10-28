import { MAX_LINE_QUANTITY, type PhoneOrderLine, type VariantGid } from "./types";

/** Quantités choisies par variante (une variante absente = 0 bouteille). */

export type Quantities = Readonly<Record<string, number>>;

/** Tailles de carton proposées en raccourci. */
export const CARTON_SIZES = [6, 12] as const;

/** Saisie libre → entier entre 0 et le maximum ; une saisie illisible donne 0. */
export function parseQuantity(raw: string): number {
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, MAX_LINE_QUANTITY);
}

function clamp(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.min(Math.trunc(quantity), MAX_LINE_QUANTITY);
}

export function setQuantity(quantities: Quantities, variantId: VariantGid, quantity: number): Quantities {
  const next = { ...quantities };
  const clamped = clamp(quantity);
  if (clamped === 0) delete next[variantId];
  else next[variantId] = clamped;
  return next;
}

export function addQuantity(quantities: Quantities, variantId: VariantGid, delta: number): Quantities {
  return setQuantity(quantities, variantId, (quantities[variantId] ?? 0) + delta);
}

export function quantityOf(quantities: Quantities, variantId: VariantGid): number {
  return quantities[variantId] ?? 0;
}

/** Lignes de commande, dans l'ordre de saisie. */
export function toLines(quantities: Quantities): PhoneOrderLine[] {
  return Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([variantId, quantity]) => ({ variantId: variantId as VariantGid, quantity }));
}
