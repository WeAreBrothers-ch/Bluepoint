import { cartonsOf, isFullCartons, nextCartonQuantity, previousCartonQuantity, quantityFromCartons } from "../../lib/commande/cart";
import { CARTON_SIZE, MAX_LINE_QUANTITY } from "../../lib/commande/types";
import { FILL } from "../fill";

/**
 * Quantité d'un vin, en cartons de 6 bouteilles (le caviste ne vend pas à l'unité).
 * Pas encore choisi : un seul bouton sur toute la largeur, « Ajouter un carton de 6 ».
 * Déjà choisi : −, le nombre de cartons, +, et la corbeille pour retirer le vin.
 */

interface QuantityStepperProps {
  readonly productLabel: string;
  readonly quantity: number;
  readonly onSet: (quantity: number) => void;
  readonly onAdd: (delta: number) => void;
}

export function QuantityStepper({ productLabel, quantity, onSet }: QuantityStepperProps) {
  if (quantity === 0) {
    return (
      <s-grid gridTemplateColumns="minmax(0, 1fr)">
        <s-button {...FILL} icon="plus" accessibilityLabel={`Ajouter un carton de ${CARTON_SIZE} bouteilles de ${productLabel}`} onClick={() => onSet(CARTON_SIZE)}>
          {`Ajouter un carton de ${CARTON_SIZE}`}
        </s-button>
      </s-grid>
    );
  }
  // − et + de part et d'autre du nombre, puis « Retirer » à droite : tient sur une ligne même sur un petit téléphone.
  return (
    <s-stack direction="block" gap="small-200">
      <s-grid gridTemplateColumns="auto 72px auto minmax(0, 1fr) auto" gap="small-200" alignItems="center">
        <s-button icon="minus" accessibilityLabel={`Retirer un carton de ${productLabel}`} onClick={() => onSet(previousCartonQuantity(quantity))} />
        <s-number-field
          label={`Nombre de cartons de ${CARTON_SIZE} bouteilles de ${productLabel}`}
          labelAccessibilityVisibility="exclusive"
          value={String(cartonsOf(quantity))}
          min={0}
          max={Math.floor(MAX_LINE_QUANTITY / CARTON_SIZE)}
          step={1}
          inputMode="numeric"
          onInput={(event) => onSet(quantityFromCartons(event.currentTarget.value))}
        />
        <s-button icon="plus" accessibilityLabel={`Ajouter un carton de ${productLabel}`} onClick={() => onSet(nextCartonQuantity(quantity))} />
        <s-text>{cartonsOf(quantity) > 1 ? "cartons" : "carton"}</s-text>
        <s-button icon="delete" variant="tertiary" tone="critical" accessibilityLabel={`Retirer ${productLabel} de la commande`} onClick={() => onSet(0)} />
      </s-grid>
      {isFullCartons(quantity) ? null : <s-text tone="caution">Ce n’est pas un carton complet.</s-text>}
    </s-stack>
  );
}
