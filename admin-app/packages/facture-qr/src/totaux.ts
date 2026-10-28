import { sommeCentimes } from "./montants";

/** Le strict nécessaire pour recalculer les totaux (sans jamais recalculer la TVA). */
export interface DonneesTotaux {
  lines: readonly { totalCents: number }[];
  discounts: readonly { amountCents: number }[];
  shipping?: { amountCents: number } | undefined;
  vatLines: readonly { amountCents: number }[];
  taxesIncluded: boolean;
}

export interface Totaux {
  articlesCents: number;
  rabaisCents: number;
  livraisonCents: number;
  tvaCents: number;
  /** Total attendu d'après les lignes : comparé au total annoncé par Shopify. */
  totalCalculeCents: number;
}

/**
 * Articles − rabais + livraison (+ TVA si les prix sont hors taxes).
 * La TVA n'est jamais recalculée : on additionne les montants fournis par Shopify.
 */
export function calculerTotaux(donnees: DonneesTotaux): Totaux {
  const articlesCents = sommeCentimes(donnees.lines.map((l) => l.totalCents));
  const rabaisCents = sommeCentimes(donnees.discounts.map((r) => r.amountCents));
  const livraisonCents = donnees.shipping?.amountCents ?? 0;
  const tvaCents = sommeCentimes(donnees.vatLines.map((t) => t.amountCents));
  const horsTva = articlesCents - rabaisCents + livraisonCents;
  return {
    articlesCents,
    rabaisCents,
    livraisonCents,
    tvaCents,
    totalCalculeCents: donnees.taxesIncluded ? horsTva : horsTva + tvaCents,
  };
}
