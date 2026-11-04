import { useCallback, useMemo, useState } from "react";
import { filterStock, sortByUrgency, stockSummary, type StockSummary } from "../../lib/stock/stock";
import type { StockPageData } from "../../lib/stock/stock.server";
import { EmptyState } from "../EmptyState";
import { NewWineForm } from "./NewWineForm";
import { StockRow } from "./StockRow";

/** Page « Stock » : la partie visible, séparée de la route pour pouvoir être affichée seule (aperçu, tests). */

function SummaryBanner({ summary }: { readonly summary: StockSummary }) {
  if (summary.soldOut.length === 0 && summary.low.length === 0) {
    return <s-banner tone="success" heading="Tous les vins sont en cave." />;
  }
  return (
    <s-banner tone={summary.soldOut.length > 0 ? "critical" : "warning"} heading="Des vins sont à recommander">
      <s-stack direction="block" gap="small-200">
        {summary.soldOut.length === 0 ? null : <s-text>{`Plus de bouteilles\u202F: ${summary.soldOut.join(", ")}`}</s-text>}
        {summary.low.length === 0 ? null : <s-text>{`Bientôt épuisés (un carton ou moins)\u202F: ${summary.low.join(", ")}`}</s-text>}
      </s-stack>
    </s-banner>
  );
}

export function StockPageView({ data }: { readonly data: StockPageData }) {
  const [search, setSearch] = useState("");
  const shown = useMemo(() => sortByUrgency(filterStock(data.items, search)), [data.items, search]);
  const summary = useMemo(() => stockSummary(data.items), [data.items]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const onCreated = useCallback((message: string) => {
    setCreating(false);
    setCreated(message);
  }, []);
  const authorized = data.canEdit && data.canCreateWines;

  return (
    <s-page heading="Mes vins en cave" inlineSize="base">
      {data.canCreateWines && !creating ? (
        <s-button
          slot="primary-action"
          variant="primary"
          icon="plus"
          onClick={() => {
            setCreated(null);
            setCreating(true);
          }}
        >
          Nouveau vin
        </s-button>
      ) : null}
      {authorized ? null : (
        <s-banner tone="warning" heading="Une étape d’autorisation reste à faire">
          Vos vins s’affichent, mais l’app ne peut pas encore changer leur nombre ni créer de vin. La personne qui s’occupe du site doit
          l’autoriser une seule fois dans Shopify ; ensuite, les boutons apparaîtront.
        </s-banner>
      )}
      {creating ? <NewWineForm onCreated={onCreated} onCancel={() => setCreating(false)} /> : null}
      {created === null ? null : <s-banner tone="success" heading={created} />}
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.loadError === null && data.items.length === 0 ? (
        <EmptyState heading="Aucun vin pour l’instant">Ajoutez votre premier vin avec « Nouveau vin », en haut de la page.</EmptyState>
      ) : null}
      {data.items.length === 0 ? null : (
        <>
          <s-section>
            <s-stack direction="block" gap="base">
              <SummaryBanner summary={summary} />
              <s-search-field
                label="Chercher un vin"
                placeholder="Nom du vin"
                value={search}
                onInput={(event) => setSearch(event.currentTarget.value)}
              />
              {data.truncated ? <s-text color="subdued">Il y a beaucoup de vins : les premiers seulement sont affichés.</s-text> : null}
              {shown.length === 0 ? <s-text>Aucun vin ne correspond à cette recherche.</s-text> : null}
            </s-stack>
          </s-section>
          {shown.map((item) => (
            <StockRow key={item.variantId} item={item} canEdit={data.canEdit} canPhoto={data.canCreateWines} />
          ))}
        </>
      )}
    </s-page>
  );
}
