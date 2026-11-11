import { bottles } from "@/data/bottles";
import type { Bottle } from "@/data/types";

/**
 * Point d'accès unique au catalogue. Le jour où Shopify ou Stripe arrive,
 * seules ces fonctions changent (elles deviendront asynchrones) : les composants
 * ne lisent jamais `bottles` directement.
 */
export function getAllBottles(): ReadonlyArray<Bottle> {
  return bottles;
}

export function getBottleBySlug(slug: string): Bottle | undefined {
  return bottles.find((bottle) => bottle.slug === slug);
}

export function requireBottle(slug: string): Bottle {
  const bottle = getBottleBySlug(slug);
  if (!bottle) throw new Error(`Bouteille introuvable dans le catalogue : « ${slug} ».`);
  return bottle;
}

/** Les autres bouteilles, pour « À découvrir aussi ». */
export function getOtherBottles(slug: string, count: number): ReadonlyArray<Bottle> {
  return bottles.filter((bottle) => bottle.slug !== slug).slice(0, count);
}

export function bottleHref(bottle: Bottle): `/bouteilles/${string}` {
  return `/bouteilles/${bottle.slug}`;
}

