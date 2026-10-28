import type { DraftOrderCalculateData } from "./mutations";
import { decimalToCents } from "./totals";

/**
 * Prix de ce client calculés par Shopify (`draftOrderCalculate`) : catalogue B2B de l'entreprise
 * et remises automatiques (ex. « Prix pro -15 % »), prêts pour le récapitulatif.
 */

export interface B2bPrices {
  /** Prix unitaire en centimes, par identifiant de variante (avant les remises sur la commande). */
  readonly unitCents: Readonly<Record<string, number>>;
  /** Sous-total après toutes les remises, y compris les remises automatiques sur la commande. */
  readonly subtotalCents: number;
  readonly currencyCode: string;
}

type Calculated = NonNullable<NonNullable<DraftOrderCalculateData["draftOrderCalculate"]>["calculatedDraftOrder"]>;

/** `null` si un montant est illisible : on garde alors les prix de base, avec un avis. */
export function readB2bPrices(calculated: Calculated): B2bPrices | null {
  const unitCents: Record<string, number> = {};
  for (const line of calculated.lineItems) {
    const cents = decimalToCents(line.approximateDiscountedUnitPriceSet.presentmentMoney.amount);
    if (line.variant === null || cents === null) return null;
    unitCents[line.variant.id] = cents;
  }
  const subtotalCents = decimalToCents(calculated.subtotalPriceSet.presentmentMoney.amount);
  if (subtotalCents === null) return null;
  return { unitCents, subtotalCents, currencyCode: calculated.currencyCode };
}

export type PriceCalculationResult =
  | { readonly ok: true; readonly prices: B2bPrices }
  | { readonly ok: false; readonly message: string };
