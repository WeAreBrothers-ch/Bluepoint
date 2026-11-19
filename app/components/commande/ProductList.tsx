import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { quantityOf, type Quantities } from "../../lib/commande/cart";
import { filterProducts } from "../../lib/commande/catalog";
import type { PriceAudience } from "../../lib/commande/price-text";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { CATALOG_MAX_VARIANTS } from "../../lib/commande/queries";
import { ChosenWines } from "./ChosenWines";
import { FILL } from "../fill";
import { ProductRow } from "./ProductRow";

/**
 * Les vins choisis en haut, puis les vins en vente avec une recherche rapide par nom.
 * Sans recherche, seuls les premiers vins sont montrés (« Voir tous les vins » pour le reste) :
 * sur un téléphone, la suite de la commande (livraison, paiement) reste à quelques coups de pouce.
 */

/** Vins montrés tant qu'on n'a rien cherché. */
export const FIRST_WINES = 6;

interface ProductListProps {
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly quantities: Quantities;
  readonly onSet: (variantId: VariantGid, quantity: number) => void;
  readonly onAdd: (variantId: VariantGid, delta: number) => void;
  /** Pro ou particulier : seul le prix de ce client est affiché ; `null` tant qu'aucun client n'est choisi. */
  readonly audience: PriceAudience;
  /** Titre de la partie ; « 2. Vins » dans « Prendre une commande ». */
  readonly heading?: string;
  /** Montré sous les vins choisis (« Modifier les vins » : les vins écrits à la main dans la commande). */
  readonly extra?: ReactNode;
}

export function ProductList({ products, truncated, quantities, onSet, onAdd, audience, heading = "2. Vins", extra }: ProductListProps) {
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const deferredFilter = useDeferredValue(filter);
  const matching = useMemo(() => filterProducts(products, deferredFilter), [products, deferredFilter]);
  const searching = deferredFilter.trim() !== "";
  // Un vin déjà choisi reste toujours visible, pour pouvoir changer son nombre de cartons.
  const visible =
    searching || showAll ? matching : matching.filter((product, index) => index < FIRST_WINES || quantityOf(quantities, product.variantId) > 0);
  const hidden = matching.length - visible.length;
  const byId = useMemo(() => new Map(products.map((product) => [product.variantId, product])), [products]);

  return (
    <s-section heading={heading}>
      <s-stack direction="block" gap="base">
        <ChosenWines products={byId} quantities={quantities} onSet={onSet} {...(extra === undefined ? {} : { emptyText: null })} />
        {extra}
        <s-search-field
          label="Chercher un vin"
          placeholder="Ex. Barolo"
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
                audience={audience}
                onSet={onSet}
                onAdd={onAdd}
              />
            ))}
            {hidden <= 0 ? null : (
              <s-grid gridTemplateColumns="minmax(0, 1fr)">
                <s-button {...FILL} variant="tertiary" icon="chevron-down" onClick={() => setShowAll(true)}>
                  {`Voir tous les vins (encore ${hidden})`}
                </s-button>
              </s-grid>
            )}
          </s-stack>
        )}
      </s-stack>
    </s-section>
  );
}
