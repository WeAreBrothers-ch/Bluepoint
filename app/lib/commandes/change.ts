import type { Quantities } from "../commande/cart";
import { MAX_LINE_QUANTITY } from "../commande/types";
import { parseGid } from "../shopify/ids";

/**
 * Changer une commande pas encore livrée : modifier les vins (quantités, vin retiré, vin ajouté)
 * ou l'annuler. Règles et calcul des changements, sans appel à Shopify (logique pure).
 */

export const ORDER_CHANGE_INTENTS = ["modifier", "annuler"] as const;
export type OrderChangeIntent = (typeof ORDER_CHANGE_INTENTS)[number];

export function isOrderChangeIntent(value: unknown): value is OrderChangeIntent {
  return ORDER_CHANGE_INTENTS.some((intent) => intent === value);
}

export type OrderChangeResult =
  | { readonly ok: true; readonly intent: OrderChangeIntent; readonly message: string }
  | { readonly ok: false; readonly intent: OrderChangeIntent | null; readonly message: string };

/** Ce que Shopify dit de la commande au moment du changement. */
export interface OrderChangeState {
  readonly cancelled: boolean;
  readonly financialStatus: string | null;
  readonly fulfillmentStatus: string | null;
  readonly hasInvoice: boolean;
}

export interface ChangeRules {
  /** Faux : commande livrée, facturée ou annulée ; la partie « Changer » n'est pas affichée. */
  readonly changeable: boolean;
  readonly canEdit: boolean;
  /** Pourquoi « Modifier les vins » n'est pas proposé, en une phrase. */
  readonly editBlocked: string | null;
  /** Le client a déjà payé : l'annulation le rembourse. */
  readonly paid: boolean;
}

/** Statuts d'expédition où rien n'est encore parti. */
const NOT_STARTED = new Set(["UNFULFILLED", "OPEN", "SCHEDULED", "PENDING_FULFILLMENT", "ON_HOLD"]);
const PAID = new Set(["PAID", "PARTIALLY_PAID"]);

export const PAID_EDIT_BLOCKED =
  "Le client a déjà payé cette commande\u202F: on ne peut plus changer les vins. S’il veut autre chose, annulez-la (il sera remboursé), puis prenez une nouvelle commande.";

export function changeRules(state: OrderChangeState): ChangeRules {
  const changeable = !state.cancelled && !state.hasInvoice && NOT_STARTED.has(state.fulfillmentStatus ?? "");
  const paid = PAID.has(state.financialStatus ?? "");
  const canEdit = changeable && state.financialStatus === "PENDING";
  const editBlocked = !changeable || canEdit ? null : paid ? PAID_EDIT_BLOCKED : "Cette commande ne peut pas être modifiée ici.";
  return { changeable, canEdit, editBlocked, paid };
}

// --- Modifier les vins ---

export interface EditableLine {
  readonly lineItemId: string;
  readonly variantId: string | null;
  readonly quantity: number;
}

export interface OrderEditPlan {
  readonly set: readonly { readonly lineItemId: string; readonly quantity: number }[];
  readonly add: readonly { readonly variantId: string; readonly quantity: number }[];
}

/** Quantités de départ de l'écran « Modifier les vins » : une ligne par vin. */
export function quantitiesFromLines(lines: readonly EditableLine[]): Quantities {
  const quantities: Record<string, number> = {};
  for (const line of lines) {
    if (line.variantId === null || line.quantity <= 0 || line.variantId in quantities) continue;
    quantities[line.variantId] = line.quantity;
  }
  return quantities;
}

/**
 * Changements à faire chez Shopify pour arriver aux quantités voulues. Seule la première ligne d'un
 * vin est modifiée (une commande n'en a normalement qu'une) ; les articles sans vin restent tels quels.
 */
export function planOrderEdit(lines: readonly EditableLine[], wanted: Quantities): OrderEditPlan {
  const seen = new Set<string>();
  const set: { lineItemId: string; quantity: number }[] = [];
  for (const line of lines) {
    if (line.variantId === null || seen.has(line.variantId)) continue;
    seen.add(line.variantId);
    const quantity = wanted[line.variantId] ?? 0;
    if (quantity !== line.quantity) set.push({ lineItemId: line.lineItemId, quantity });
  }
  const add = Object.entries(wanted)
    .filter(([variantId, quantity]) => quantity > 0 && !seen.has(variantId))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
  return { set, add };
}

export function isEmptyPlan(plan: OrderEditPlan): boolean {
  return plan.set.length === 0 && plan.add.length === 0;
}

/** Bouteilles restantes après les changements (articles sans vin compris). */
export function bottlesAfter(lines: readonly EditableLine[], plan: OrderEditPlan): number {
  const changed = new Map(plan.set.map((entry) => [entry.lineItemId, entry.quantity]));
  const kept = lines.reduce((sum, line) => sum + (changed.get(line.lineItemId) ?? line.quantity), 0);
  return kept + plan.add.reduce((sum, entry) => sum + entry.quantity, 0);
}

const MAX_WINES = 200;

/** Quantités voulues envoyées par la page (JSON « variante → bouteilles »). `null` si illisibles. */
export function parseWantedQuantities(raw: FormDataEntryValue | null): Quantities | null {
  if (typeof raw !== "string" || raw.length > 20_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const entries = Object.entries(parsed);
  if (entries.length > MAX_WINES) return null;
  const quantities: Record<string, number> = {};
  for (const [variantId, quantity] of entries) {
    if (parseGid(variantId, "ProductVariant") === null) return null;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) return null;
    if (quantity > 0) quantities[variantId] = quantity;
  }
  return quantities;
}

/** Identifiant de la ligne pendant la modification : même numéro, autre type (« CalculatedLineItem »). */
export function calculatedLineId(lineItemId: string): string | null {
  const gid = parseGid(lineItemId, "LineItem");
  return gid === null ? null : `gid://shopify/CalculatedLineItem/${gid.slice(gid.lastIndexOf("/") + 1)}`;
}

export const EMPTY_ORDER_MESSAGE = "Il ne resterait plus aucune bouteille. Pour tout enlever, annulez plutôt la commande.";
export const NOTHING_CHANGED_MESSAGE = "Rien n’a changé\u202F: la commande reste comme avant.";
