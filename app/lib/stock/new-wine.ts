import { formatChf } from "../format/money";
import { BOTTLE_SIZES_CL, DEFAULT_BOTTLE_CL, parseBottleSize, plain, sizeTagValue, TAG_PREFIXES, WINE_COUNTRIES } from "../litres/wine-info";
import { CARTON_SIZE } from "../commande/types";
import { cartonsText, MAX_CARTONS } from "./stock";

/**
 * « Nouveau vin » depuis la page Stock : nom, producteur, sorte, pays, contenance, prix et bouteilles en cave.
 * Lecture et vérification du formulaire, messages en français simple (logique pure).
 */

export const WINE_TYPES = ["Rouge", "Blanc", "Rosé", "Champagne", "Effervescent", "Spiritueux", "Autre"] as const;
export type WineType = (typeof WINE_TYPES)[number];

export const NEW_WINE_FIELDS = ["title", "vendor", "type", "country", "size", "vintage", "appellation", "region", "price", "quantity"] as const;
export type NewWineField = (typeof NEW_WINE_FIELDS)[number];

export type NewWineValues = Readonly<Record<NewWineField, string>>;
export type NewWineErrors = Partial<Record<NewWineField, string>>;

export const EMPTY_NEW_WINE: NewWineValues = {
  title: "",
  vendor: "",
  type: "Rouge",
  country: "",
  size: sizeTagValue(DEFAULT_BOTTLE_CL * 10),
  vintage: "",
  appellation: "",
  region: "",
  price: "",
  quantity: "0",
};

/** Les contenances proposées, avec le nom qu'on leur donne. */
export const BOTTLE_SIZE_CHOICES: readonly { readonly value: string; readonly label: string }[] = BOTTLE_SIZES_CL.map((cl) => ({
  value: String(cl),
  label: cl === 75 ? "75 cl (bouteille habituelle)" : cl === 150 ? "150 cl (magnum)" : cl === 300 ? "300 cl (double magnum)" : `${cl} cl`,
}));

export const COUNTRY_CHOICES = WINE_COUNTRIES;

/** Le champagne vient toujours de France : le pays n'est pas demandé. */
export function isChampagneChoice(type: string): boolean {
  return plain(type) === "champagne";
}

export interface NewWineInput {
  readonly title: string;
  readonly vendor: string | null;
  /** `null` pour « Autre » : pas de sorte affichée sur le site. Le champagne est rangé avec les effervescents. */
  readonly productType: string | null;
  /** Étiquettes Shopify du vin : sorte, pays, région, contenance, année, appellation. */
  readonly tags: readonly string[];
  /** Ce qui a été écrit dans le formulaire, pour le réafficher si Shopify refuse. */
  readonly values: NewWineValues;
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
    country: text(form, "country"),
    size: text(form, "size") || EMPTY_NEW_WINE.size,
    vintage: text(form, "vintage"),
    appellation: text(form, "appellation"),
    region: text(form, "region"),
    price: text(form, "price"),
    quantity: text(form, "quantity") || "0",
  };
  const errors: NewWineErrors = {};
  if (values.title.length < 2) errors.title = "Écrivez le nom du vin.";
  else if (values.title.length > 120) errors.title = "Ce nom est trop long (120 lettres au plus).";
  if (values.vendor.length > 120) errors.vendor = "Ce nom est trop long (120 lettres au plus).";
  if (!isWineType(values.type)) errors.type = "Choisissez la sorte de vin.";
  const isOther = values.type === "Autre";
  const champagne = isChampagneChoice(values.type);
  const country = champagne ? "France" : values.country;
  if (!isOther && !champagne && !WINE_COUNTRIES.some((known) => known === country)) errors.country = "Choisissez le pays d’où vient le vin.";
  const bottleMl = parseBottleSize(values.size);
  if (!isOther && bottleMl === null) errors.size = "Choisissez la contenance de la bouteille.";
  if (values.vintage !== "" && !/^\d{4}$/.test(values.vintage)) errors.vintage = "L’année s’écrit avec quatre chiffres, par exemple 2022.";
  if (values.appellation.length > 80) errors.appellation = "Ce nom est trop long (80 lettres au plus).";
  if (values.region.length > 80) errors.region = "Ce nom est trop long (80 lettres au plus).";
  const priceCents = parsePrice(values.price);
  if (priceCents === null || priceCents <= 0) errors.price = "Écrivez le prix d’une bouteille, par exemple 25.50.";
  else if (priceCents > MAX_PRICE_CENTS) errors.price = "Ce prix semble trop élevé.";
  // Le formulaire demande des cartons de 6 ; Shopify compte des bouteilles.
  const cartonCount = /^\d{1,6}$/.test(values.quantity) ? Number(values.quantity) : null;
  if (cartonCount === null || cartonCount > MAX_CARTONS) errors.quantity = "Écrivez le nombre de cartons (0 s’il n’y en a pas encore).";
  const quantity = cartonCount === null ? null : cartonCount * CARTON_SIZE;
  if (Object.keys(errors).length > 0 || priceCents === null || quantity === null) return { ok: false, values, errors };
  const productType = isOther ? null : champagne ? "Effervescent" : values.type;
  const appellation = champagne ? "Champagne" : values.appellation;
  const tags = [
    ...(productType === null ? [] : [plain(productType)]),
    ...(isOther ? [] : [`${TAG_PREFIXES.country}:${country}`]),
    ...(values.region === "" ? [] : [`${TAG_PREFIXES.region}:${values.region}`]),
    ...(isOther || bottleMl === null ? [] : [`${TAG_PREFIXES.size}:${sizeTagValue(bottleMl)}`]),
    ...(values.vintage === "" ? [] : [`${TAG_PREFIXES.vintage}:${values.vintage}`]),
    ...(appellation === "" ? [] : [`${TAG_PREFIXES.appellation}:${appellation}`]),
  ];
  return {
    ok: true,
    input: {
      title: values.title,
      vendor: values.vendor === "" ? null : values.vendor,
      productType,
      tags,
      values: { ...values, country, vintage: values.vintage, appellation },
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
  const stock = input.quantity === 0 ? "sans carton en cave pour l’instant" : `avec ${cartonsText(input.quantity)} en cave`;
  const where = published
    ? "Il est en vente sur le site et dans « Prendre une commande »."
    : "Il est dans « Prendre une commande », mais pas encore visible sur le site.";
  return `Le vin « ${input.title} » est créé, à ${formatChf(input.priceCents)}, ${stock}. ${where}`;
}
