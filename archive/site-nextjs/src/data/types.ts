/**
 * Modèle d'une bouteille. Pensé pour être alimenté plus tard par Shopify ou Stripe :
 * `slug` sert d'identifiant commun (handle Shopify / metadata Stripe), les prix sont
 * en centimes et la devise est explicite.
 */
export type Currency = "CHF";

export type BottleCategory = "rouge" | "blanc" | "effervescent" | "spiritueux";

export interface BottleImage {
  /** Photo détourée (fond transparent), servie depuis /public. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

export type TableMoment = "Apéritif" | "Entrée" | "Plat" | "Fromage" | "Dessert";

export interface Pairing {
  moment: TableMoment;
  dish: string;
  why: string;
}

/** Contenu éditorial de la fiche (metafields Shopify le jour venu). */
export interface BottleStory {
  tasting: string;
  serving: string;
  storage: string;
  producer: string;
  /** Exactement trois temps : de l'apéritif au dessert. */
  pairings: readonly [Pairing, Pairing, Pairing];
}

export interface Bottle {
  slug: string;
  name: string;
  producer: string;
  region: string;
  grape: string;
  category: BottleCategory;
  description: string;
  priceCents: number;
  currency: Currency;
  volumeMl: number;
  /** Degré d'alcool en % vol. */
  abv: number;
  image: BottleImage;
  /**
   * Photo de mise en scène affichée à la place de la bouteille détourée.
   * PROVISOIRE (maquette) : photos d'autres domaines, à remplacer avant la vente réelle.
   */
  photo?: BottleImage;
  story: BottleStory;
  /** Champs à confirmer par le client avant mise en ligne. */
  provisional: ReadonlyArray<"description" | "abv" | "story">;
}
