/** Prix d'un vin saisi à la main : « 55 », « 55.5 », « 55,50 » ou « CHF 55.00 » → centimes. Logique pure, testée sans Shopify. */

export const PRICE_MAX_CENTS = 1_000_000; // 10'000 CHF : au-delà, c'est une faute de frappe.

export type PriceParse =
  | { readonly ok: true; readonly cents: number }
  | { readonly ok: false; readonly message: string };

export function parsePrice(raw: string): PriceParse {
  const text = raw.replace(/CHF|Fr\.?|['’\s]/gi, "").replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(text)) {
    return { ok: false, message: "Écrivez le prix en francs, par exemple 55 ou 55.50." };
  }
  const cents = Math.round(Number(text) * 100);
  if (cents <= 0) return { ok: false, message: "Le prix doit être plus grand que zéro." };
  if (cents > PRICE_MAX_CENTS) return { ok: false, message: "Ce prix semble trop élevé. Vérifiez-le." };
  return { ok: true, cents };
}

/** Le prix tel que Shopify l'attend : « 55.50 ». */
export function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export type PriceResult =
  | { readonly ok: true; readonly variantId: string; readonly message: string }
  | { readonly ok: false; readonly variantId: string; readonly message: string };
