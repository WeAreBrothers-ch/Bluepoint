import { memo } from "react";
import { winePriceText, type PriceAudience } from "../../lib/commande/price-text";
import { isOverStock, productLabel } from "../../lib/commande/totals";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { formatInteger } from "../../lib/format/money";
import { QuantityStepper } from "./QuantityStepper";

/**
 * Un vin : son nom, son prix (celui du client choisi), le stock, puis « Ajouter un carton de 6 ».
 * Pensé pour un téléphone : la photo seulement si le vin en a une (pas de case grise vide), à côté du nom.
 * Un vin choisi se voit tout de suite : fond grisé, bord marqué, et le nombre de cartons entre − et +.
 */

interface ProductRowProps {
  readonly product: ProductOption;
  readonly quantity: number;
  /** Pro ou particulier : seul le prix de ce client est affiché. `null` : pas encore de client, les deux prix. */
  readonly audience: PriceAudience;
  readonly onSet: (variantId: VariantGid, quantity: number) => void;
  readonly onAdd: (variantId: VariantGid, delta: number) => void;
}

function StockLine({ available }: { readonly available: number | null }) {
  if (available === null) return null;
  if (available <= 0) return <s-text tone="critical">Plus de bouteilles en cave</s-text>;
  return <s-text color="subdued">{`${bottlesText(available)} en cave`}</s-text>;
}

export function bottlesText(quantity: number): string {
  return `${formatInteger(quantity)} bouteille${quantity > 1 ? "s" : ""}`;
}

function ProductRowView({ product, quantity, audience, onSet, onAdd }: ProductRowProps) {
  const label = productLabel(product);
  const overStock = isOverStock(product, quantity);
  const chosen = quantity > 0;

  return (
    <s-box padding="base" borderRadius="base" border={chosen ? "large strong" : "base"} background={chosen ? "subdued" : "base"}>
      <s-stack direction="block" gap="small-200">
        <s-grid gridTemplateColumns={product.imageUrl === null ? "minmax(0, 1fr)" : "auto minmax(0, 1fr)"} gap="small-200" alignItems="center">
          {product.imageUrl === null ? null : <s-thumbnail src={product.imageUrl} alt={product.imageAlt} size="small" />}
          <s-stack direction="block" gap="small-500">
            <s-text type="strong">{label}</s-text>
            <s-text>{winePriceText(product.priceCents, audience)}</s-text>
            <StockLine available={product.available} />
          </s-stack>
        </s-grid>
        <QuantityStepper
          productLabel={label}
          quantity={quantity}
          onSet={(next) => onSet(product.variantId, next)}
          onAdd={(delta) => onAdd(product.variantId, delta)}
        />
        {overStock ? (
          <s-text tone="caution">
            {`Vous en avez ${formatInteger(product.available ?? 0)} en cave\u202F: la commande reste possible.`}
          </s-text>
        ) : null}
      </s-stack>
    </s-box>
  );
}

/** Mémorisé : taper une quantité ne redessine que la ligne concernée. */
export const ProductRow = memo(ProductRowView);
