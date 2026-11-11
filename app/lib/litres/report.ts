import { formatAmount, formatInteger } from "../format/money";
import { NBSP } from "../format/typography";
import {
  ASSUMED_BOTTLE_ML,
  CATEGORY_ORDER,
  categoryOf,
  countryOf,
  isWineCategory,
  readWineInfo,
  type WineCategory,
} from "./wine-info";

/**
 * Litres de vin vendus sur une année : on additionne, pour chaque bouteille vendue, sa contenance.
 * Tout est compté en millilitres entiers (jamais de virgule flottante), puis affiché en litres.
 * Logique pure : les commandes sont lues ailleurs (report.server.ts).
 */

/** Une ligne de commande vendue. */
export interface SoldLine {
  /** Identifiant Shopify du vin, ou null si le vin a été supprimé depuis. */
  readonly productId: string | null;
  readonly title: string;
  readonly vendor: string | null;
  readonly productType: string | null;
  readonly tags: readonly string[];
  /** Nombre de bouteilles. */
  readonly bottles: number;
  /** Mois de la vente (1 à 12), en heure suisse. */
  readonly month: number;
}

export const NO_COUNTRY = "Pays non renseigné";

/** Un vin, avec ce qui a été vendu sur la période. */
export interface WineRow {
  readonly key: string;
  readonly productId: string | null;
  readonly title: string;
  readonly vendor: string | null;
  readonly category: WineCategory;
  readonly country: string | null;
  readonly region: string | null;
  readonly appellation: string | null;
  readonly vintage: string | null;
  readonly bottleMl: number;
  /** Vrai si la contenance n'est pas écrite sur le vin : 75 cl est supposé. */
  readonly bottleMlAssumed: boolean;
  readonly bottles: number;
  readonly ml: number;
}

/** Total d'une sorte dans un pays. */
export interface CategoryCountryRow {
  readonly category: WineCategory;
  readonly country: string;
  readonly bottles: number;
  readonly ml: number;
}

export interface IncompleteWine {
  readonly productId: string;
  readonly title: string;
  readonly category: WineCategory;
  readonly bottles: number;
  readonly missing: readonly ("contenance" | "pays")[];
  /** Ce qui est déjà connu, pour préremplir la correction. */
  readonly country: string | null;
  readonly bottleMl: number | null;
}

export interface LitresReport {
  readonly wines: readonly WineRow[];
  /** Les vins seulement (rouge, blanc, rosé, orange, champagne, effervescent). */
  readonly byCategoryCountry: readonly CategoryCountryRow[];
  readonly totals: {
    readonly wineBottles: number;
    readonly wineMl: number;
    /** Les spiritueux : comptés à part, hors du total du vin. */
    readonly spiritsBottles: number;
    readonly spiritsMl: number;
    /** Produits qui ne sont ni du vin ni un spiritueux (coffrets, accessoires) : bouteilles seulement. */
    readonly otherUnits: number;
  };
  /** Litres de vin par mois, janvier à décembre. */
  readonly monthlyMl: readonly number[];
  readonly incomplete: readonly IncompleteWine[];
  /** Bouteilles de vin comptées avec une contenance supposée (75 cl). */
  readonly assumedBottles: number;
}

export function buildReport(lines: readonly SoldLine[]): LitresReport {
  const byWine = new Map<string, WineRow>();
  const monthlyMl: number[] = Array.from({ length: 12 }, () => 0);
  let otherUnits = 0;

  for (const line of lines) {
    if (line.bottles <= 0) continue;
    const info = readWineInfo(line.productType, line.tags);
    const category = categoryOf(info);
    if (category === "Autre") {
      otherUnits += line.bottles;
      continue;
    }
    const assumed = info.bottleMl === null;
    const bottleMl = info.bottleMl ?? ASSUMED_BOTTLE_ML;
    const key = line.productId ?? `titre:${line.title}`;
    const ml = bottleMl * line.bottles;
    const previous = byWine.get(key);
    byWine.set(key, {
      key,
      productId: line.productId,
      title: line.title,
      vendor: line.vendor,
      category,
      country: countryOf(info),
      region: info.region,
      appellation: info.appellation,
      vintage: info.vintage,
      bottleMl,
      bottleMlAssumed: assumed,
      bottles: (previous?.bottles ?? 0) + line.bottles,
      ml: (previous?.ml ?? 0) + ml,
    });
    if (isWineCategory(category) && line.month >= 1 && line.month <= 12) monthlyMl[line.month - 1] = (monthlyMl[line.month - 1] ?? 0) + ml;
  }

  const rank = (category: WineCategory) => CATEGORY_ORDER.indexOf(category);
  const wines = [...byWine.values()].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      (a.country ?? "~").localeCompare(b.country ?? "~", "fr") ||
      a.title.localeCompare(b.title, "fr"),
  );
  const wineRows = wines.filter((wine) => isWineCategory(wine.category));
  const spirits = wines.filter((wine) => wine.category === "Spiritueux");

  const grouped = new Map<string, CategoryCountryRow>();
  for (const wine of wineRows) {
    const country = wine.country ?? NO_COUNTRY;
    const key = `${wine.category}|${country}`;
    const previous = grouped.get(key);
    grouped.set(key, { category: wine.category, country, bottles: (previous?.bottles ?? 0) + wine.bottles, ml: (previous?.ml ?? 0) + wine.ml });
  }
  const byCategoryCountry = [...grouped.values()].sort(
    (a, b) => rank(a.category) - rank(b.category) || (a.country === NO_COUNTRY ? 1 : 0) - (b.country === NO_COUNTRY ? 1 : 0) || a.country.localeCompare(b.country, "fr"),
  );

  const incomplete: IncompleteWine[] = [];
  for (const wine of wines) {
    if (wine.productId === null) continue;
    const missing: ("contenance" | "pays")[] = [];
    if (wine.bottleMlAssumed) missing.push("contenance");
    if (isWineCategory(wine.category) && wine.country === null) missing.push("pays");
    if (missing.length === 0) continue;
    incomplete.push({
      productId: wine.productId,
      title: wine.title,
      category: wine.category,
      bottles: wine.bottles,
      missing,
      country: wine.country,
      bottleMl: wine.bottleMlAssumed ? null : wine.bottleMl,
    });
  }

  return {
    wines,
    byCategoryCountry,
    totals: {
      wineBottles: wineRows.reduce((sum, wine) => sum + wine.bottles, 0),
      wineMl: wineRows.reduce((sum, wine) => sum + wine.ml, 0),
      spiritsBottles: spirits.reduce((sum, wine) => sum + wine.bottles, 0),
      spiritsMl: spirits.reduce((sum, wine) => sum + wine.ml, 0),
      otherUnits,
    },
    monthlyMl,
    incomplete,
    assumedBottles: wineRows.filter((wine) => wine.bottleMlAssumed).reduce((sum, wine) => sum + wine.bottles, 0),
  };
}

/** Millilitres → « 1’234.50 L » (deux décimales, apostrophe des milliers). */
export function formatLiters(ml: number): string {
  return `${formatAmount(Math.round(ml / 10))}${NBSP}L`;
}

/** Contenance d'une bouteille : « 75 cl », « 37.5 cl », « 1.5 L » pour un magnum. */
export function formatBottleSize(ml: number): string {
  if (ml >= 1000) return `${Math.round(ml) / 1000}${NBSP}L`;
  return `${Math.round(ml) / 10}${NBSP}cl`;
}

export function formatBottles(count: number): string {
  return `${formatInteger(count)}${NBSP}bouteille${count > 1 ? "s" : ""}`;
}

export const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"] as const;
