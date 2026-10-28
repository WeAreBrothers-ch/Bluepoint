import type { OrderTotals, StockWarning } from "../../lib/commande/totals";
import { formatChf, formatInteger } from "../../lib/format/money";

/** Récapitulatif : lignes, total, alertes de stock et bouton « Créer la commande ». */

export type PriceSource = "base" | "b2b" | "b2b_en_cours" | "b2b_indisponible";

const PRICE_NOTES: Readonly<Record<PriceSource, string>> = {
  base: "Prix de base des variantes. Frais de livraison et taxes calculés par Shopify à la création.",
  b2b: "Prix du catalogue B2B de l’entreprise, calculés par Shopify.",
  b2b_en_cours: "Calcul des prix du catalogue B2B…",
  b2b_indisponible: "Prix du catalogue B2B indisponibles : prix de base affichés. Shopify appliquera le catalogue à la création.",
};

interface OrderSummaryProps {
  readonly totals: OrderTotals;
  readonly warnings: readonly StockWarning[];
  readonly priceSource: PriceSource;
  readonly linesError: string | undefined;
  readonly canSubmit: boolean;
  readonly submitting: boolean;
  readonly onSubmit: () => void;
}

export function OrderSummary(props: OrderSummaryProps) {
  const { totals, warnings } = props;
  return (
    <s-section heading="Récapitulatif">
      <s-stack direction="block" gap="base">
        {totals.lines.length === 0 ? (
          <s-text color="subdued">Aucune bouteille choisie.</s-text>
        ) : (
          <s-stack direction="block" gap="small-200">
            {totals.lines.map((line) => (
              <s-stack key={line.variantId} direction="inline" justifyContent="space-between" gap="base">
                <s-text>{`${formatInteger(line.quantity)} × ${line.label}`}</s-text>
                <s-text fontVariantNumeric="tabular-nums">{formatChf(line.totalCents)}</s-text>
              </s-stack>
            ))}
            <s-divider />
            <s-stack direction="inline" justifyContent="space-between" gap="base">
              <s-text type="strong">{`Sous-total, ${formatInteger(totals.totalQuantity)} bouteilles`}</s-text>
              <s-text type="strong" fontVariantNumeric="tabular-nums">{formatChf(totals.subtotalCents)}</s-text>
            </s-stack>
          </s-stack>
        )}
        <s-text color="subdued">{PRICE_NOTES[props.priceSource]}</s-text>
        {warnings.length === 0 ? null : (
          <s-banner tone="warning" heading="Stock insuffisant pour certains produits">
            <s-stack direction="block" gap="small-300">
              {warnings.map((warning) => (
                <s-text key={warning.variantId}>
                  {`${warning.label}\u202F: ${formatInteger(warning.requested)} demandées, ${formatInteger(warning.available)} en stock.`}
                </s-text>
              ))}
              <s-text>La commande peut quand même être créée.</s-text>
            </s-stack>
          </s-banner>
        )}
        {props.linesError === undefined ? null : <s-banner tone="critical" heading={props.linesError} />}
        <s-stack direction="inline" justifyContent="end">
          <s-button
            variant="primary"
            onClick={props.onSubmit}
            {...(props.submitting ? { loading: true } : {})}
            {...(props.canSubmit && !props.submitting ? {} : { disabled: true })}
          >
            Créer la commande
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
