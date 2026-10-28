import { useDeferredValue, useMemo, useState } from "react";
import { quantityOf, type Quantities } from "../../lib/commande/cart";
import { filterProducts } from "../../lib/commande/catalog";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { CATALOG_MAX_VARIANTS } from "../../lib/commande/queries";
import { ChosenWines } from "./ChosenWines";
import { ProductRow } from "./ProductRow";

/** Les vins choisis en haut, puis les vins en vente avec une recherche rapide par nom. */

interface ProductListProps {
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly quantities: Quantities;
  readonly onSet: (variantId: VariantGid, quantity: number) => void;
  readonly onAdd: (variantId: VariantGid, delta: number) => void;
  /** Titre de la partie ; « 2. Vins » dans « Prendre une commande ». */
  readonly heading?: string;
}

export function ProductList({ products, truncated, quantities, onSet, onAdd, heading = "2. Vins" }: ProductListProps) {
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);
  const visible = useMemo(() => filterProducts(products, deferredFilter), [products, deferredFilter]);
  const byId = useMemo(() => new Map(products.map((product) => [product.variantId, product])), [products]);

  return (
    <s-section heading={heading}>
      <s-stack direction="block" gap="base">
        <ChosenWines products={byId} quantities={quantities} onSet={onSet} />
        <s-search-field
          label="Chercher un vin"
          placeholder="Nom du vin, par exemple « Barolo »"
          value={filter}
          onInput={(event) => setFilter(event.currentTarget.value)}
        />
        {truncated ? (
          <s-banner tone="warning" heading="Certains vins ne sont pas affichés">
            {`La liste s’arrête aux ${CATALOG_MAX_VARIANTS} premiers vins.`}
          </s-banner>
        ) : null}
        {visible.length === 0 ? (
          <s-text color="subdued">
            {products.length === 0 ? "Aucun vin en vente dans la boutique." : "Aucun vin ne correspond. Effacez la recherche pour tout revoir."}
          </s-text>
        ) : (
          <s-stack direction="block" gap="small-200">
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
