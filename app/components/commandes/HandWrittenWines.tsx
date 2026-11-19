import type { HandQuantities } from "../../lib/commandes/hand-lines";
import { formatChf } from "../../lib/format/money";
import { QuantityStepper } from "../commande/QuantityStepper";

/**
 * Vins écrits à la main dans Shopify (sans lien avec le catalogue) : ils se changent ici comme les autres,
 * par cartons (−, +, corbeille), au prix de la commande. Une ligne mise à zéro se remet avec « Ajouter un carton ».
 */

export interface HandWrittenWine {
  readonly lineItemId: string;
  readonly name: string;
  /** Prix d'une bouteille dans la commande ; `null` s'il n'est pas connu. */
  readonly unitCents: number | null;
}

interface HandWrittenWinesProps {
  readonly wines: readonly HandWrittenWine[];
  readonly quantities: HandQuantities;
  readonly onSet: (lineItemId: string, quantity: number) => void;
}

function HandWrittenRow({ wine, quantity, onSet }: { readonly wine: HandWrittenWine; readonly quantity: number; readonly onSet: (quantity: number) => void }) {
  const chosen = quantity > 0;
  return (
    <s-box padding="base" borderRadius="base" border={chosen ? "large strong" : "base"} background={chosen ? "subdued" : "base"}>
      <s-stack direction="block" gap="small-200">
        <s-stack direction="block" gap="small-500">
          <s-text type="strong">{wine.name}</s-text>
          {wine.unitCents === null ? null : <s-text>{`${formatChf(wine.unitCents)} la bouteille (prix de la commande)`}</s-text>}
        </s-stack>
        <QuantityStepper productLabel={wine.name} quantity={quantity} onSet={onSet} onAdd={(delta) => onSet(quantity + delta)} />
      </s-stack>
    </s-box>
  );
}

export function HandWrittenWines({ wines, quantities, onSet }: HandWrittenWinesProps) {
  return (
    <s-stack direction="block" gap="small-200">
      <s-text color="subdued">Vins écrits à la main dans la commande</s-text>
      {wines.map((wine) => (
        <HandWrittenRow key={wine.lineItemId} wine={wine} quantity={quantities[wine.lineItemId] ?? 0} onSet={(quantity) => onSet(wine.lineItemId, quantity)} />
      ))}
    </s-stack>
  );
}
