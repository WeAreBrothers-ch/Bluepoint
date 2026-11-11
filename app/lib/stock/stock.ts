import { CARTON_SIZE } from "../commande/types";
import { normalizeSearch } from "../commande/catalog";
import { decimalToCents } from "../commande/totals";
import { formatInteger } from "../format/money";
import { parseGid } from "../shopify/ids";

/**
 * Stock des vins : ce qui reste à vendre, ce qui est réservé pour des commandes pas encore livrées,
 * et les changements demandés (« Ajouter des cartons », « Corriger le nombre »). Logique pure.
 * La boutique a un seul dépôt : on lit et on change le stock du premier emplacement de chaque vin.
 */

export const STOCK_PAGE_SIZE = 100;
export const STOCK_MAX_VARIANTS = 500;
/** Jusqu'à un carton (6 bouteilles), le vin est signalé « bientôt épuisé ». */
export const LOW_STOCK = 6;
export const MAX_STOCK_CHANGE = 99_999;

export const STOCK_QUERY = `#graphql
query StockVins($first: Int!, $after: String) {
  productVariants(first: $first, after: $after, query: "product_status:active", sortKey: FULL_TITLE) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      title
      price
      product { id title hasOnlyDefaultVariant featuredMedia { preview { image { url altText } } } }
      inventoryItem {
        id
        tracked
        inventoryLevels(first: 1) {
          nodes { location { id } quantities(names: ["available", "on_hand", "committed"]) { name quantity } }
        }
      }
    }
  }
}`;

export interface StockVariantNode {
  readonly id: string;
  readonly title: string;
  readonly price: string;
  readonly product: {
    readonly id: string;
    readonly title: string;
    readonly hasOnlyDefaultVariant: boolean;
    readonly featuredMedia: {
      readonly preview: { readonly image: { readonly url: string; readonly altText: string | null } | null } | null;
    } | null;
  };
  readonly inventoryItem: {
    readonly id: string;
    readonly tracked: boolean;
    readonly inventoryLevels: {
      readonly nodes: readonly {
        readonly location: { readonly id: string };
        readonly quantities: readonly { readonly name: string; readonly quantity: number }[];
      }[];
    };
  } | null;
}

export interface StockData {
  readonly productVariants: {
    readonly pageInfo: { readonly hasNextPage: boolean; readonly endCursor: string | null };
    readonly nodes: readonly StockVariantNode[];
  };
}

/** « epuise » : plus rien à vendre ; « bas » : un carton ou moins ; « non_suivi » : stock pas compté. */
export type StockLevel = "epuise" | "bas" | "ok" | "non_suivi";

/** Où changer le stock d'un vin suivi. */
export interface StockPlace {
  readonly inventoryItemId: string;
  readonly locationId: string;
}

export interface StockItem {
  readonly variantId: string;
  /** Pour changer la photo du vin. */
  readonly productId: string;
  readonly label: string;
  readonly priceCents: number | null;
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  /** Bouteilles qu'on peut encore vendre. */
  readonly available: number;
  /** Bouteilles en cave, y compris celles réservées. */
  readonly onHand: number;
  /** Bouteilles réservées pour des commandes pas encore livrées. */
  readonly committed: number;
  readonly level: StockLevel;
  /** `null` : stock pas suivi, rien à changer ici. */
  readonly place: StockPlace | null;
}

export function stockLevel(available: number): Exclude<StockLevel, "non_suivi"> {
  if (available <= 0) return "epuise";
  return available <= LOW_STOCK ? "bas" : "ok";
}

function quantity(quantities: readonly { readonly name: string; readonly quantity: number }[], name: string): number {
  return quantities.find((entry) => entry.name === name)?.quantity ?? 0;
}

export function toStockItem(node: StockVariantNode): StockItem {
  const label = node.product.hasOnlyDefaultVariant ? node.product.title : `${node.product.title} — ${node.title}`;
  const image = node.product.featuredMedia?.preview?.image ?? null;
  const level = node.inventoryItem?.tracked ? (node.inventoryItem.inventoryLevels.nodes[0] ?? null) : null;
  const base = {
    variantId: node.id,
    productId: node.product.id,
    label,
    priceCents: decimalToCents(node.price),
    imageUrl: image?.url ?? null,
    imageAlt: image?.altText?.trim() || label,
  };
  if (node.inventoryItem === null || level === null) {
    return { ...base, available: 0, onHand: 0, committed: 0, level: "non_suivi", place: null };
  }
  const available = quantity(level.quantities, "available");
  return {
    ...base,
    available,
    onHand: quantity(level.quantities, "on_hand"),
    committed: quantity(level.quantities, "committed"),
    level: stockLevel(available),
    place: { inventoryItemId: node.inventoryItem.id, locationId: level.location.id },
  };
}

export interface StockSummary {
  readonly soldOut: readonly string[];
  readonly low: readonly string[];
}

export function stockSummary(items: readonly StockItem[]): StockSummary {
  return {
    soldOut: items.filter((item) => item.level === "epuise").map((item) => item.label),
    low: items.filter((item) => item.level === "bas").map((item) => item.label),
  };
}

const LEVEL_ORDER: Readonly<Record<StockLevel, number>> = { epuise: 0, bas: 1, ok: 2, non_suivi: 3 };

/** Les vins à recommander d'abord (plus en stock, puis bientôt épuisés) ; à égalité, l'ordre d'origine est gardé. */
export function sortByUrgency(items: readonly StockItem[]): StockItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => LEVEL_ORDER[a.item.level] - LEVEL_ORDER[b.item.level] || a.index - b.index)
    .map(({ item }) => item);
}

/** Chaque mot tapé doit apparaître dans le nom du vin (sans tenir compte des accents). */
export function filterStock(items: readonly StockItem[], raw: string): readonly StockItem[] {
  const words = normalizeSearch(raw).split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return items;
  return items.filter((item) => {
    const label = normalizeSearch(item.label);
    return words.every((word) => label.includes(word));
  });
}

export function bottles(count: number): string {
  return `${formatInteger(count)} bouteille${Math.abs(count) > 1 ? "s" : ""}`;
}

/** Ex. « 5 bouteilles disponibles », « Plus aucune bouteille à vendre ». */
export function availableText(item: Pick<StockItem, "available">): string {
  if (item.available <= 0) return "Plus aucune bouteille à vendre";
  return `${bottles(item.available)} disponible${item.available > 1 ? "s" : ""}`;
}

/** Ex. « 11 en cave, dont 6 réservées pour des commandes pas encore livrées » ; `null` si rien n'est réservé. */
export function reservedText(item: Pick<StockItem, "onHand" | "committed">): string | null {
  if (item.committed <= 0) return null;
  const reserved = item.committed > 1 ? "réservées" : "réservée";
  return `En cave\u202F: ${cartonsText(item.onHand)}, dont ${bottles(item.committed)} ${reserved} pour des commandes pas encore livrées`;
}

// --- Changements demandés depuis la page ---

export const STOCK_INTENTS = ["ajouter", "corriger"] as const;
export type StockIntent = (typeof STOCK_INTENTS)[number];

export interface StockChange extends StockPlace {
  readonly intent: StockIntent;
  /** « ajouter » : bouteilles reçues ; « corriger » : bouteilles comptées en cave. */
  readonly quantity: number;
  /** Quantité affichée au moment du changement : Shopify refuse si elle a bougé entre-temps. */
  readonly expected: number;
  /** Clé d'idempotence : un double toucher n'ajoute pas deux fois. */
  readonly key: string;
}

export type StockActionResult =
  | { readonly ok: true; readonly inventoryItemId: string; readonly message: string }
  | { readonly ok: false; readonly inventoryItemId: string | null; readonly message: string };

const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

function readInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !/^-?\d{1,6}$/.test(value.trim())) return null;
  return Number(value.trim());
}

function isStockIntent(value: unknown): value is StockIntent {
  return STOCK_INTENTS.some((intent) => intent === value);
}

export type ParsedStockChange =
  | { readonly ok: true; readonly change: StockChange }
  | { readonly ok: false; readonly inventoryItemId: string | null; readonly message: string };

export function parseStockChange(form: FormData): ParsedStockChange {
  const intent = form.get("intent");
  const rawItem = form.get("inventoryItemId");
  const rawLocation = form.get("locationId");
  const inventoryItemId = typeof rawItem === "string" ? parseGid(rawItem, "InventoryItem") : null;
  const locationId = typeof rawLocation === "string" ? parseGid(rawLocation, "Location") : null;
  const key = form.get("key");
  const expected = readInteger(form.get("expected"));
  if (!isStockIntent(intent) || inventoryItemId === null || locationId === null || expected === null) {
    return { ok: false, inventoryItemId, message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };
  }
  if (typeof key !== "string" || !IDEMPOTENCY_KEY.test(key)) {
    return { ok: false, inventoryItemId, message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };
  }
  const value = readInteger(form.get("quantity"));
  const min = intent === "ajouter" ? 1 : 0;
  if (value === null || value < min || value > MAX_STOCK_CHANGE) {
    const message =
      intent === "ajouter"
        ? "Indiquez combien de bouteilles arrivent (au moins 1)."
        : "Indiquez combien de bouteilles il y a en cave (0 s’il n’y en a plus).";
    return { ok: false, inventoryItemId, message };
  }
  return { ok: true, change: { intent, inventoryItemId, locationId, quantity: value, expected, key } };
}

/** Message de réussite, avec la nouvelle quantité si Shopify l'a donnée. */
export function stockChangeMessage(change: Pick<StockChange, "intent" | "quantity">, after: number | null): string {
  if (change.intent === "ajouter") {
    const added = `C’est noté\u202F: ${cartonsText(change.quantity)} ajouté${change.quantity > CARTON_SIZE ? "s" : ""}.`;
    if (after === null) return added;
    if (after <= 0) return `${added} Des commandes attendent encore ce vin\u202F: rien n’est disponible à la vente.`;
    return `${added} Il y a maintenant ${cartonsText(after)} à vendre.`;
  }
  return `C’est noté\u202F: ${cartonsText(after ?? change.quantity)} en cave.`;
}

export const STALE_STOCK_MESSAGE =
  "Le stock de ce vin a changé entre-temps (une commande vient peut-être d’arriver). Rechargez la page, puis recommencez.";

// --- Cartons et palettes : la cave se compte en cartons de 6, pas bouteille par bouteille ---

/**
 * Cartons d'une palette, pour le bouton « + 1 palette ». Valeur courante pour des cartons de 6 bouteilles
 * de 75 cl sur une palette standard : à ajuster ici si les palettes reçues sont différentes.
 */
export const PALLET_CARTONS = 100;

/** Plus grand nombre de cartons qu'on peut écrire d'un coup. */
export const MAX_CARTONS = Math.floor(MAX_STOCK_CHANGE / CARTON_SIZE);

/** « 12 » → 12 ; vide ou illisible → 0 ; jamais négatif, jamais au-delà de `max`. */
export function parseCount(raw: string, max: number): number {
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, max);
}

/** 446 bouteilles → 74 cartons pleins et 2 bouteilles seules. */
export function splitCartons(count: number): { readonly cartons: number; readonly loose: number } {
  const total = Math.max(count, 0);
  return { cartons: Math.floor(total / CARTON_SIZE), loose: total % CARTON_SIZE };
}

export function cartons(count: number): string {
  return `${formatInteger(count)} carton${count > 1 ? "s" : ""}`;
}

/** « 74 cartons et 2 bouteilles », « 1 carton », « 4 bouteilles », « aucune bouteille ». */
export function cartonsText(count: number): string {
  const { cartons: full, loose } = splitCartons(count);
  if (full === 0 && loose === 0) return "aucune bouteille";
  if (full === 0) return bottles(loose);
  return loose === 0 ? cartons(full) : `${cartons(full)} et ${bottles(loose)}`;
}

/** Au-delà de 10 cartons d'un coup, l'ajout est confirmé : une faute de frappe (100 au lieu de 10) se voit. */
export const LARGE_ADDITION = 10 * CARTON_SIZE;

/**
 * Faut-il redemander avant d'enregistrer ? Pour un comptage : passer à 0 ou changer de plus d'un carton.
 * Pour un ajout : plus de 10 cartons d'un coup. Renvoie la question à poser, ou null.
 */
export function confirmationQuestion(intent: StockIntent, onHand: number, quantity: number): string | null {
  if (intent === "ajouter") {
    return quantity > LARGE_ADDITION ? `Vous ajoutez ${cartonsText(quantity)} (${bottles(quantity)}) d’un coup. C’est bien ça\u202F?` : null;
  }
  const current = Math.max(onHand, 0);
  if (quantity === current) return null;
  if (quantity === 0 || Math.abs(quantity - current) > CARTON_SIZE) {
    return `Vous passez de ${cartonsText(current)} à ${cartonsText(quantity)} en cave. C’est bien ça\u202F?`;
  }
  return null;
}
