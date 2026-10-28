import { CARTON_SIZES, parseQuantity } from "../../lib/commande/cart";
import { MAX_LINE_QUANTITY } from "../../lib/commande/types";

/**
 * Boutons de quantité d'un vin, sur une seule ligne.
 * Pas encore choisi : « Ajouter 1 bouteille » et les cartons. Déjà choisi : −, la quantité, +, cartons, « Retirer ».
 */

interface QuantityStepperProps {
  readonly productLabel: string;
  readonly quantity: number;
  readonly onSet: (quantity: number) => void;
  readonly onAdd: (delta: number) => void;
}

function CartonButtons({ productLabel, onAdd }: Pick<QuantityStepperProps, "productLabel" | "onAdd">) {
  return (
    <>
      {CARTON_SIZES.map((size) => (
        <s-button key={size} accessibilityLabel={`Ajouter un carton de ${size} de ${productLabel}`} onClick={() => onAdd(size)}>
          {`+ carton de ${size}`}
        </s-button>
      ))}
    </>
  );
}

export function QuantityStepper({ productLabel, quantity, onSet, onAdd }: QuantityStepperProps) {
  if (quantity === 0) {
    return (
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-button icon="plus" accessibilityLabel={`Ajouter une bouteille de ${productLabel}`} onClick={() => onAdd(1)}>
          Ajouter 1 bouteille
        </s-button>
        <CartonButtons productLabel={productLabel} onAdd={onAdd} />
      </s-stack>
    );
  }
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-button icon="minus" accessibilityLabel={`Retirer une bouteille de ${productLabel}`} onClick={() => onAdd(-1)} />
      <s-box inlineSize="80px">
        <s-number-field
          label={`Nombre de bouteilles de ${productLabel}`}
          labelAccessibilityVisibility="exclusive"
          value={String(quantity)}
          min={0}
          max={MAX_LINE_QUANTITY}
          step={1}
          inputMode="numeric"
          onInput={(event) => onSet(parseQuantity(event.currentTarget.value))}
        />
      </s-box>
      <s-button icon="plus" accessibilityLabel={`Ajouter une bouteille de ${productLabel}`} onClick={() => onAdd(1)} />
      <CartonButtons productLabel={productLabel} onAdd={onAdd} />
      <s-button icon="delete" variant="tertiary" tone="critical" accessibilityLabel={`Retirer ${productLabel} de la commande`} onClick={() => onSet(0)}>
        Retirer
      </s-button>
    </s-stack>
  );
}
