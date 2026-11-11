import type { Currency } from "@/data/types";

const formatters = new Map<Currency, Intl.NumberFormat>();

function currencyFormatter(currency: Currency): Intl.NumberFormat {
  const cached = formatters.get(currency);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat("fr-CH", { style: "currency", currency });
  formatters.set(currency, formatter);
  return formatter;
}

/** Les prix sont stockés en centimes pour éviter les erreurs d'arrondi. */
export function formatPrice(cents: number, currency: Currency): string {
  return currencyFormatter(currency).format(cents / 100);
}

export function formatVolume(millilitres: number): string {
  return `${millilitres / 10} cl`;
}

export function formatAbv(percent: number): string {
  return `${percent.toLocaleString("fr-CH")} % vol.`;
}
