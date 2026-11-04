import { CARTON_SIZE, MAX_LINE_QUANTITY, type PhoneOrderLine, type VariantGid } from "./types";

/** Quantités choisies par variante (une variante absente = 0 bouteille). */

export type Quantities = Readonly<Record<string, number>>;

/** Tailles de carton proposées en raccourci (arrivée de vin en cave). */
export const CARTON_SIZES = [6, 12] as const;

/** Une quantité de vente est valable si elle fait un nombre entier de cartons de 6 (au moins un). */
export function isFullCartons(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= CARTON_SIZE && quantity % CARTON_SIZE === 0;
}

/** Nombre de cartons complets d'une quantité (6 bouteilles → 1, 12 → 2). */
export function cartonsOf(quantity: number): number {
  return Math.floor(quantity / CARTON_SIZE);
}

/** Quantité d'après un nombre de cartons tapé (« 2 » → 12 bouteilles) ; une saisie illisible donne 0. */
export function quantityFromCartons(raw: string): number {
  const cartons = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(cartons) || cartons <= 0) return 0;
  return Math.min(cartons * CARTON_SIZE, Math.floor(MAX_LINE_QUANTITY / CARTON_SIZE) * CARTON_SIZE);
}

/** Un carton de plus : 0 → 6, 6 → 12 ; une quantité qui n'est pas un carton complet (3, 9…) passe au carton du dessus. */
export function nextCartonQuantity(quantity: number): number {
  return (cartonsOf(quantity) + 1) * CARTON_SIZE;
}

/** Un carton de moins : 12 → 6, 6 → 0 ; 9 → 6, 3 → 0. */
export function previousCartonQuantity(quantity: number): number {
  return Math.max(0, Math.ceil(quantity / CARTON_SIZE) - 1) * CARTON_SIZE;
}

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
