import { useDeferredValue, useMemo, useState } from "react";
import { quantityOf, type Quantities } from "../../lib/commande/cart";
import { filterProducts } from "../../lib/commande/catalog";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { CATALOG_MAX_VARIANTS } from "../../lib/commande/queries";
import { ProductRow } from "./ProductRow";

/** Catalogue des produits actifs, avec filtre rapide (nom, variante ou SKU). */

interface ProductListProps {
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly quantities: Quantities;
  readonly onSet: (variantId: VariantGid, quantity: number) => void;
  readonly onAdd: (variantId: VariantGid, delta: number) => void;
}

export function ProductList({ products, truncated, quantities, onSet, onAdd }: ProductListProps) {
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);
  const visible = useMemo(() => filterProducts(products, deferredFilter), [products, deferredFilter]);

  return (
    <s-section heading="Bouteilles">
      <s-stack direction="block" gap="base">
        <s-search-field
          label="Filtrer les produits"
          placeholder="Nom, millésime ou SKU"
          value={filter}
          onInput={(event) => setFilter(event.currentTarget.value)}
        />
        {truncated ? (
          <s-banner tone="warning" heading="Catalogue incomplet">
            {`Seules les ${CATALOG_MAX_VARIANTS} premières variantes actives sont affichées.`}
          </s-banner>
        ) : null}
        {visible.length === 0 ? (
          <s-text color="subdued">
            {products.length === 0 ? "Aucun produit actif dans la boutique." : "Aucun produit ne correspond au filtre."}
          </s-text>
        ) : (
          <s-stack direction="block" gap="none">
            {visible.map((product) => (
              <ProductRow
                key={product.variantId}
                product={product}
                quantity={quantityOf(quantities, product.variantId)}
                onSet={onSet}
                onAdd={onAdd}
              />
            ))}
          </s-stack>
        )}
      </s-stack>
    </s-section>
  );
}
