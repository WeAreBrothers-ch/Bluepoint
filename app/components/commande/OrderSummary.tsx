import type { ReactNode } from "react";
import type { OrderTotals, StockWarning } from "../../lib/commande/totals";
import { formatChf, formatInteger } from "../../lib/format/money";
import { FILL } from "../fill";

/** Récapitulatif : vins, remise (ex. prix pro), total, alertes de stock et bouton « Enregistrer la commande ». */

/** D'où viennent les prix affichés. */
export type PriceSource = "normal" | "calcul" | "client" | "indisponible";

const PRICE_NOTES: Readonly<Record<PriceSource, string>> = {
  normal: "TVA comprise. Frais de livraison en plus s’il y en a.",
  calcul: "Calcul des prix de ce client…",
  client: "Prix de ce client, remises et TVA comprises.",
  indisponible: "Prix normaux affichés\u202F: les remises de ce client seront appliquées à l’enregistrement.",
};

interface OrderSummaryProps {
  readonly totals: OrderTotals;
  /** Remise sur la commande (ex. « Prix pro ») calculée par Shopify, en centimes. */
  readonly discountCents: number;
  readonly warnings: readonly StockWarning[];
  readonly priceSource: PriceSource;
  readonly linesError: string | undefined;
  /** Ce qui manque pour pouvoir enregistrer ; `null` si tout est prêt. */
  readonly missing: string | null;
  readonly submitting: boolean;
  readonly onSubmit: () => void;
  /** Résultat du dernier enregistrement, affiché juste au-dessus du bouton. */
  readonly outcome: ReactNode;
}

function Row({ label, amount, strong = false }: { readonly label: string; readonly amount: string; readonly strong?: boolean }) {
  const type = strong ? { type: "strong" as const } : {};
  return (
    // Le montant reste à droite même quand le nom du vin passe sur deux lignes.
    <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base" alignItems="start">
      <s-text {...type}>{label}</s-text>
      <s-text fontVariantNumeric="tabular-nums" {...type}>
        {amount}
      </s-text>
    </s-grid>
  );
}

export function OrderSummary(props: OrderSummaryProps) {
  const { totals, warnings, discountCents } = props;
  const bottles = `${formatInteger(totals.totalQuantity)} bouteille${totals.totalQuantity > 1 ? "s" : ""}`;
  return (
    <s-section heading="4. Récapitulatif">
      <s-stack direction="block" gap="base">
        {totals.lines.length === 0 ? (
          <s-text color="subdued">Aucun vin choisi pour l’instant.</s-text>
        ) : (
          <s-stack direction="block" gap="small-200">
            {totals.lines.map((line) => (
              <Row key={line.variantId} label={`${formatInteger(line.quantity)} × ${line.label}`} amount={formatChf(line.totalCents)} />
            ))}
            {discountCents > 0 ? <Row label="Remise" amount={`−${formatChf(discountCents)}`} /> : null}
            <s-divider />
            <Row label={`Total, ${bottles}`} amount={formatChf(totals.subtotalCents - discountCents)} strong />
          </s-stack>
        )}
        <s-text color="subdued">{PRICE_NOTES[props.priceSource]}</s-text>
        {warnings.length === 0 ? null : (
          <s-banner tone="warning" heading="Pas assez de bouteilles pour certains vins">
            <s-stack direction="block" gap="small-300">
              {warnings.map((warning) => (
                <s-text key={warning.variantId}>
                  {`${warning.label}\u202F: ${formatInteger(warning.requested)} demandées, ${formatInteger(warning.available)} en cave.`}
                </s-text>
              ))}
              <s-text>Vous pouvez quand même enregistrer la commande.</s-text>
            </s-stack>
          </s-banner>
        )}
        {props.linesError === undefined ? null : <s-banner tone="critical" heading={props.linesError} />}
        {props.outcome}
        {props.missing === null ? null : <s-text color="subdued">{props.missing}</s-text>}
        <s-grid gridTemplateColumns="minmax(0, 1fr)">
          <s-button
            {...FILL}
            variant="primary"
            icon="check"
            onClick={props.onSubmit}
            {...(props.submitting ? { loading: true } : {})}
            {...(props.missing === null && !props.submitting ? {} : { disabled: true })}
          >
            Enregistrer la commande
          </s-button>
        </s-grid>
      </s-stack>
    </s-section>
  );
}
