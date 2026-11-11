/**
 * Ce qu'on sait d'un vin pour compter les litres vendus : sorte, pays, contenance de la bouteille, année, appellation.
 *
 * La boutique range déjà ses vins avec le « type de produit » (Rouge, Blanc, Rosé, Effervescent…) et des étiquettes
 * « pays:Italie », « region:Piémont » (voir docs/README-boutique.md). On garde cette habitude et on ajoute trois étiquettes :
 * « contenance:75 » (en cl), « millesime:2022 » et « appellation:Champagne ». Rien à créer dans Shopify, et le site
 * (menu par type et par région) continue de fonctionner comme avant.
 */

export const WINE_COUNTRIES = ["France", "Italie", "Suisse"] as const;

/** Contenances proposées dans l'app, en centilitres. 75 cl est la bouteille habituelle. */
export const BOTTLE_SIZES_CL = [37.5, 50, 70, 75, 150, 300] as const;
export const DEFAULT_BOTTLE_CL = 75;

/** Une bouteille sans contenance connue est comptée à 75 cl, et signalée à vérifier. */
export const ASSUMED_BOTTLE_ML = 750;

export const TAG_PREFIXES = {
  country: "pays",
  region: "region",
  size: "contenance",
  vintage: "millesime",
  appellation: "appellation",
} as const;

export type TagKind = keyof typeof TAG_PREFIXES;

export interface WineInfo {
  readonly productType: string | null;
  readonly country: string | null;
  readonly region: string | null;
  readonly appellation: string | null;
  readonly vintage: string | null;
  /** Contenance d'une bouteille en millilitres (750 pour 75 cl), ou null si inconnue. */
  readonly bottleMl: number | null;
}

/** Minuscules, sans accent, sans espace superflu : pour comparer « Rosé » et « rose ». */
export function plain(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function tagValue(tags: readonly string[], prefix: string): string | null {
  for (const tag of tags) {
    const colon = tag.indexOf(":");
    if (colon < 0) continue;
    if (plain(tag.slice(0, colon)) !== prefix) continue;
    const value = tag.slice(colon + 1).trim();
    if (value !== "") return value;
  }
  return null;
}

/** « 75 », « 75cl », « 37,5 », « 0.75 l », « 750 ml » → millilitres ; null si illisible. */
export function parseBottleSize(raw: string): number | null {
  const text = plain(raw).replace(/\s+/g, "").replace(",", ".");
  const match = /^(\d+(?:\.\d+)?)(cl|ml|l)?$/.exec(text);
  if (match === null) return null;
  const amount = Number(match[1]);
  const unit = match[2] ?? "cl";
  const ml = unit === "ml" ? amount : unit === "l" ? amount * 1000 : amount * 10;
  const rounded = Math.round(ml);
  return rounded >= 20 && rounded <= 20_000 ? rounded : null;
}

/** Le pays tel qu'on l'écrit : « italie » → « Italie ». Un pays inconnu reste tel quel (première lettre en majuscule). */
export function canonicalCountry(raw: string): string {
  const known = WINE_COUNTRIES.find((country) => plain(country) === plain(raw));
  if (known !== undefined) return known;
  const text = raw.trim();
  return text === "" ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

export function readWineInfo(productType: string | null, tags: readonly string[]): WineInfo {
  const country = tagValue(tags, TAG_PREFIXES.country);
  const size = tagValue(tags, TAG_PREFIXES.size);
  return {
    productType: productType === null || productType.trim() === "" ? null : productType.trim(),
    country: country === null ? null : canonicalCountry(country),
    region: tagValue(tags, TAG_PREFIXES.region),
    appellation: tagValue(tags, TAG_PREFIXES.appellation),
    vintage: tagValue(tags, TAG_PREFIXES.vintage),
    bottleMl: size === null ? null : parseBottleSize(size),
  };
}

/** « 37.5 » ou « 75 » : un nombre de centilitres sans zéros inutiles, comme dans l'étiquette. */
export function sizeTagValue(bottleMl: number): string {
  return String(Math.round(bottleMl) / 10);
}

export interface WineTagChanges {
  readonly country?: string | null;
  readonly region?: string | null;
  readonly appellation?: string | null;
  readonly vintage?: string | null;
  readonly bottleMl?: number | null;
}

/**
 * Les étiquettes d'un vin avec les changements demandés : seules les étiquettes concernées sont remplacées,
 * toutes les autres (sorte, promotions, etc.) restent telles quelles. `null` retire l'étiquette.
 */
export function withWineTags(tags: readonly string[], changes: WineTagChanges): string[] {
  const replaced = new Set<string>();
  const additions: string[] = [];
  const add = (kind: TagKind, value: string | null | undefined) => {
    if (value === undefined) return;
    replaced.add(TAG_PREFIXES[kind]);
    if (value !== null && value.trim() !== "") additions.push(`${TAG_PREFIXES[kind]}:${value.trim()}`);
  };
  add("country", changes.country);
  add("region", changes.region);
  add("appellation", changes.appellation);
  add("vintage", changes.vintage);
  add("size", changes.bottleMl === undefined ? undefined : changes.bottleMl === null ? null : sizeTagValue(changes.bottleMl));
  const kept = tags.filter((tag) => {
    const colon = tag.indexOf(":");
    return colon < 0 || !replaced.has(plain(tag.slice(0, colon)));
  });
  return [...kept, ...additions];
}

export type WineCategory = "Rouge" | "Blanc" | "Rosé" | "Orange" | "Champagne" | "Effervescent" | "Spiritueux" | "Autre";

/** Ordre d'affichage dans les tableaux. */
export const CATEGORY_ORDER: readonly WineCategory[] = ["Rouge", "Blanc", "Rosé", "Orange", "Champagne", "Effervescent", "Spiritueux", "Autre"];

export function isChampagne(info: Pick<WineInfo, "productType" | "appellation">): boolean {
  return plain(info.productType ?? "") === "champagne" || plain(info.appellation ?? "").includes("champagne");
}

export function categoryOf(info: Pick<WineInfo, "productType" | "appellation">): WineCategory {
  if (isChampagne(info)) return "Champagne";
  switch (plain(info.productType ?? "")) {
    case "rouge":
      return "Rouge";
    case "blanc":
      return "Blanc";
    case "rose":
      return "Rosé";
    case "orange":
      return "Orange";
    case "effervescent":
      return "Effervescent";
    case "spiritueux":
      return "Spiritueux";
    default:
      return "Autre";
  }
}

/** Les produits du vin : ce que le contrôle suisse du commerce des vins compte. Les spiritueux et le reste, non. */
export function isWineCategory(category: WineCategory): boolean {
  return category !== "Spiritueux" && category !== "Autre";
}

/** Le champagne vient toujours de France (appellation protégée) : on n'a pas à le demander. */
export function countryOf(info: Pick<WineInfo, "productType" | "appellation" | "country">): string | null {
  return isChampagne(info) ? "France" : info.country;
}
