import { CARTON_SIZES, parseQuantity } from "../../lib/commande/cart";
import { MAX_LINE_QUANTITY } from "../../lib/commande/types";
import { TouchButton } from "./TouchButton";

/** Quantité d'une variante : −, saisie libre, +, et raccourcis carton de 6 et de 12. */

interface QuantityStepperProps {
  readonly productLabel: string;
  readonly quantity: number;
  readonly onSet: (quantity: number) => void;
  readonly onAdd: (delta: number) => void;
}

export function QuantityStepper({ productLabel, quantity, onSet, onAdd }: QuantityStepperProps) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <TouchButton label={`Retirer une bouteille de ${productLabel}`} onPress={() => onAdd(-1)} disabled={quantity === 0}>
        <s-icon type="minus" />
      </TouchButton>
      <s-box inlineSize="88px">
        <s-number-field
          label={`Quantité de ${productLabel}`}
          labelAccessibilityVisibility="exclusive"
          value={String(quantity)}
          min={0}
          max={MAX_LINE_QUANTITY}
          step={1}
          inputMode="numeric"
          onInput={(event) => onSet(parseQuantity(event.currentTarget.value))}
        />
      </s-box>
      <TouchButton label={`Ajouter une bouteille de ${productLabel}`} onPress={() => onAdd(1)}>
        <s-icon type="plus" />
      </TouchButton>
      {CARTON_SIZES.map((size) => (
        <TouchButton key={size} label={`Ajouter un carton de ${size} de ${productLabel}`} onPress={() => onAdd(size)}>
          <s-text>{`+ carton de ${size}`}</s-text>
        </TouchButton>
      ))}
    </s-stack>
  );
}
