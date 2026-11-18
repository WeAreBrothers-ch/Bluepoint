import { cartonsOf, isFullCartons, toLines, type Quantities } from "../../lib/commande/cart";
import { productLabel } from "../../lib/commande/totals";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { bottlesText } from "./ProductRow";

/**
 * Les vins déjà choisis, en haut de l'étape 2 : on voit la commande en cours sans descendre
 * jusqu'au récapitulatif, et on peut retirer un vin d'un toucher.
 */

interface ChosenWinesProps {
  readonly products: ReadonlyMap<string, ProductOption>;
  readonly quantities: Quantities;
  readonly onSet: (variantId: VariantGid, quantity: number) => void;
}

export function ChosenWines({ products, quantities, onSet }: ChosenWinesProps) {
  const lines = toLines(quantities);
  if (lines.length === 0) {
    return <s-text color="subdued">Aucun vin choisi pour l’instant. Cherchez un vin, puis touchez « Ajouter un carton de 6 ».</s-text>;
  }
  const bottles = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <s-banner tone="success" heading={`Dans la commande\u202F: ${bottlesText(bottles)}`}>
      <s-stack direction="block" gap="small-200">
        {lines.map((line) => {
          const product = products.get(line.variantId);
          const label = product === undefined ? "Vin qui n’est plus en vente" : productLabel(product);
          // Une ligne par vin : « 2 cartons · Barolo », et la corbeille au bout (pas de bouton qui passe à la ligne).
          return (
            <s-grid key={line.variantId} gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
              <s-text>
                <s-text type="strong">{cartonsShort(line.quantity)}</s-text>
                {` · ${label}`}
              </s-text>
              <s-button
                variant="tertiary"
                tone="critical"
                icon="delete"
                accessibilityLabel={`Retirer ${label} de la commande`}
                onClick={() => onSet(line.variantId, 0)}
              />
            </s-grid>
          );
        })}
      </s-stack>
    </s-banner>
  );
}

/** « 2 cartons », ou « 3 bouteilles » pour une ancienne ligne qui n'est pas un carton complet. */
function cartonsShort(quantity: number): string {
  if (!isFullCartons(quantity)) return bottlesText(quantity);
  const cartons = cartonsOf(quantity);
  return `${cartons} carton${cartons > 1 ? "s" : ""}`;
}
