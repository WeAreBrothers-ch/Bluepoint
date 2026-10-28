import { formatChf } from "../format/money";
import { bottles, MAX_STOCK_CHANGE } from "./stock";

/**
 * « Nouveau vin » depuis la page Stock : nom, producteur, sorte, prix et bouteilles en cave.
 * Lecture et vérification du formulaire, messages en français simple (logique pure).
 */

export const WINE_TYPES = ["Rouge", "Blanc", "Rosé", "Effervescent", "Spiritueux", "Autre"] as const;
export type WineType = (typeof WINE_TYPES)[number];

export const NEW_WINE_FIELDS = ["title", "vendor", "type", "price", "quantity"] as const;
export type NewWineField = (typeof NEW_WINE_FIELDS)[number];

export type NewWineValues = Readonly<Record<NewWineField, string>>;
export type NewWineErrors = Partial<Record<NewWineField, string>>;

export const EMPTY_NEW_WINE: NewWineValues = { title: "", vendor: "", type: "Rouge", price: "", quantity: "0" };

export interface NewWineInput {
  readonly title: string;
  readonly vendor: string | null;
  /** `null` pour « Autre » : pas de sorte affichée sur le site. */
  readonly productType: string | null;
  readonly priceCents: number;
  readonly quantity: number;
}

export type NewWineResult =
  | { readonly ok: true; readonly intent: "nouveau_vin"; readonly message: string }
  | { readonly ok: false; readonly intent: "nouveau_vin"; readonly message: string; readonly values: NewWineValues; readonly errors: NewWineErrors };

const MAX_PRICE_CENTS = 10_000_000;

/** « 25 », « 25.50 », « 25,50 », « 25.- », « CHF 25 » → centimes ; `null` si illisible. */
export function parsePrice(raw: string): number | null {
  const cleaned = raw
    .replace(/chf/gi, "")
    .replace(/[\s'’]/g, "")
    .replace(",", ".")
    .replace(/\.?-$/, "");
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (match === null) return null;
  const [, francs = "0", decimals = ""] = match;
  return Number(francs) * 100 + Number(decimals.padEnd(2, "0"));
}

function text(form: FormData, field: NewWineField): string {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function isWineType(value: string): value is WineType {
  return WINE_TYPES.some((type) => type === value);
}

export type ParsedNewWine =
  | { readonly ok: true; readonly input: NewWineInput }
  | { readonly ok: false; readonly values: NewWineValues; readonly errors: NewWineErrors };

export function parseNewWine(form: FormData): ParsedNewWine {
  const values: NewWineValues = {
    title: text(form, "title"),
    vendor: text(form, "vendor"),
    type: text(form, "type"),
    price: text(form, "price"),
    quantity: text(form, "quantity") || "0",
  };
  const errors: NewWineErrors = {};
  if (values.title.length < 2) errors.title = "Écrivez le nom du vin.";
  else if (values.title.length > 120) errors.title = "Ce nom est trop long (120 lettres au plus).";
  if (values.vendor.length > 120) errors.vendor = "Ce nom est trop long (120 lettres au plus).";
  if (!isWineType(values.type)) errors.type = "Choisissez la sorte de vin.";
  const priceCents = parsePrice(values.price);
  if (priceCents === null || priceCents <= 0) errors.price = "Écrivez le prix d’une bouteille, par exemple 25.50.";
  else if (priceCents > MAX_PRICE_CENTS) errors.price = "Ce prix semble trop élevé.";
  const quantity = /^\d{1,6}$/.test(values.quantity) ? Number(values.quantity) : null;
  if (quantity === null || quantity > MAX_STOCK_CHANGE) errors.quantity = "Écrivez le nombre de bouteilles (0 s’il n’y en a pas encore).";
  if (Object.keys(errors).length > 0 || priceCents === null || quantity === null) return { ok: false, values, errors };
  return {
    ok: true,
    input: {
      title: values.title,
      vendor: values.vendor === "" ? null : values.vendor,
      productType: values.type === "Autre" ? null : values.type,
      priceCents,
      quantity,
    },
  };
}

/** Prix au format attendu par Shopify : « 25.50 ». */
export function shopifyPrice(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Ex. « Le vin « Chasselas 2025 » est créé, à CHF 18.00, avec 24 bouteilles en cave. » */
export function createdMessage(input: Pick<NewWineInput, "title" | "priceCents" | "quantity">, published: boolean): string {
  const stock = input.quantity === 0 ? "sans bouteille en cave pour l’instant" : `avec ${bottles(input.quantity)} en cave`;
  const where = published
    ? "Il est en vente sur le site et dans « Prendre une commande »."
    : "Il est dans « Prendre une commande », mais pas encore visible sur le site.";
  return `Le vin « ${input.title} » est créé, à ${formatChf(input.priceCents)}, ${stock}. ${where}`;
}
