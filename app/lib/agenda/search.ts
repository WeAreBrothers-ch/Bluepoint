import { addDays } from "./dates";
import type { DateRange } from "./types";

/**
 * Filtres de recherche Shopify (syntaxe `query` de la requête `orders`).
 * Deux recherches : les commandes encore à livrer (toutes, même anciennes : elles sont en retard),
 * et les commandes déjà expédiées récemment, pour les montrer « livrées » dans la semaine affichée.
 */

/** Marge avant le début de la semaine pour retrouver les commandes expédiées en avance. */
const FULFILLED_LOOKBACK_DAYS = 14;

export function openOrdersSearch(): string {
  return "status:open AND -status:cancelled AND -fulfillment_status:fulfilled";
}

export function fulfilledOrdersSearch(window: DateRange): string {
  const since = addDays(window.start, -FULFILLED_LOOKBACK_DAYS);
  return `fulfillment_status:fulfilled AND -status:cancelled AND updated_at:>='${since}T00:00:00Z'`;
}
