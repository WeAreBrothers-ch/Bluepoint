import { memo } from "react";
import { isOverStock, productLabel } from "../../lib/commande/totals";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { formatChf, formatInteger } from "../../lib/format/money";
import { QuantityStepper } from "./QuantityStepper";

/** Une variante du catalogue : vignette, nom, SKU, prix, stock et quantité choisie. */

interface ProductRowProps {
  readonly product: ProductOption;
  readonly quantity: number;
  readonly onSet: (variantId: VariantGid, quantity: number) => void;
  readonly onAdd: (variantId: VariantGid, delta: number) => void;
}

function stockText(available: number | null): string {
  if (available === null) return "Stock non suivi";
  return available <= 0 ? "Rupture de stock" : `${formatInteger(available)} en stock`;
}

function ProductRowView({ product, quantity, onSet, onAdd }: ProductRowProps) {
  const label = productLabel(product);
  const overStock = isOverStock(product, quantity);

  return (
    <s-box padding="small-100 none" borderStyle="none none solid none" borderWidth="small" borderColor="subdued">
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {product.imageUrl === null ? (
            <s-thumbnail alt="" size="small" />
          ) : (
            <s-thumbnail src={product.imageUrl} alt={product.imageAlt} size="small" />
          )}
          <s-stack direction="block" gap="small-500">
            <s-text type="strong">{label}</s-text>
            <s-text color="subdued">
              {[product.sku === null ? null : `SKU ${product.sku}`, formatChf(product.priceCents), stockText(product.available)]
                .filter((part) => part !== null)
                .join(" · ")}
            </s-text>
          </s-stack>
        </s-stack>
        <QuantityStepper
          productLabel={label}
          quantity={quantity}
          onSet={(next) => onSet(product.variantId, next)}
          onAdd={(delta) => onAdd(product.variantId, delta)}
        />
        {overStock ? (
          <s-text tone="caution">
            {`Plus que le stock disponible (${formatInteger(product.available ?? 0)})\u202F: la commande reste possible.`}
          </s-text>
        ) : null}
      </s-stack>
    </s-box>
  );
}

/** Mémorisé : taper une quantité ne redessine que la ligne concernée. */
export const ProductRow = memo(ProductRowView);
