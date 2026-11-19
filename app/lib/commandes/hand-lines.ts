import { isFullCartons, type Quantities } from "../commande/cart";
import { MAX_LINE_QUANTITY } from "../commande/types";
import { parseGid } from "../shopify/ids";
import { planOrderEdit, type EditableLine, type OrderEditPlan } from "./change";

/**
 * Vins écrits à la main dans Shopify (ligne sans lien avec le catalogue, comme sur une commande d'essai) :
 * ils se changent aussi dans « Modifier les vins », par cartons. Une ligne à la main qui n'est pas en cartons
 * complets (frais, verres…) reste telle quelle. Les quantités voulues sont rangées par ligne de commande.
 */

/** Champ envoyé par la page : JSON « ligne de commande → bouteilles ». */
export const HAND_LINES_FIELD = "lignes";

/** Bouteilles voulues par ligne écrite à la main ; 0 retire la ligne. */
export type HandQuantities = Readonly<Record<string, number>>;

const MAX_HAND_LINES = 100;

/** Une ligne sans vin du catalogue, en cartons complets : un vin écrit à la main. */
export function isHandWrittenWine(line: EditableLine): boolean {
  return line.variantId === null && line.quantity > 0 && isFullCartons(line.quantity);
}

/** Quantités de départ des vins écrits à la main. */
export function handQuantitiesFromLines(lines: readonly EditableLine[]): HandQuantities {
  return Object.fromEntries(lines.filter(isHandWrittenWine).map((line) => [line.lineItemId, line.quantity]));
}

/** Nouveau nombre de bouteilles d'une ligne, borné comme pour les vins du catalogue ; 0 est gardé (la ligne sera retirée). */
export function setHandQuantity(current: HandQuantities, lineItemId: string, quantity: number): HandQuantities {
  const bounded = Number.isFinite(quantity) ? Math.min(Math.max(Math.trunc(quantity), 0), MAX_LINE_QUANTITY) : 0;
  return { ...current, [lineItemId]: bounded };
}

function isWantedQuantity(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_LINE_QUANTITY;
}

/**
 * Quantités envoyées par la page. Rien d'envoyé (page ouverte avant ce changement) : rien à changer.
 * `null` si l'envoi est abîmé (clé qui n'est pas une ligne de commande, quantité impossible).
 */
export function parseWantedHandLines(raw: FormDataEntryValue | null): HandQuantities | null {
  if (raw === null) return {};
  if (typeof raw !== "string" || raw.length > 20_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const entries: [string, unknown][] = Object.entries(parsed);
  if (entries.length > MAX_HAND_LINES) return null;
  const wanted: Record<string, number> = {};
  for (const [lineItemId, quantity] of entries) {
    if (parseGid(lineItemId, "LineItem") === null || !isWantedQuantity(quantity)) return null;
    wanted[lineItemId] = quantity;
  }
  return wanted;
}

/** Les changements du catalogue, plus ceux des vins écrits à la main (seules ces lignes-là sont touchées). */
export function planWithHandLines(lines: readonly EditableLine[], wanted: Quantities, wantedHand: HandQuantities): OrderEditPlan {
  const plan = planOrderEdit(lines, wanted);
  const hand = lines.flatMap((line) => {
    const quantity = wantedHand[line.lineItemId];
    return isHandWrittenWine(line) && quantity !== undefined && quantity !== line.quantity ? [{ lineItemId: line.lineItemId, quantity }] : [];
  });
  return { set: [...plan.set, ...hand], add: plan.add };
}
