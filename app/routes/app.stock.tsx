import { useCallback, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { EmptyState } from "../components/EmptyState";
import { NewWineForm } from "../components/stock/NewWineForm";
import { StockRow } from "../components/stock/StockRow";
import { filterStock, stockSummary, type StockActionResult, type StockSummary } from "../lib/stock/stock";
import type { NewWineResult } from "../lib/stock/new-wine";
import { handleNewWine } from "../lib/stock/new-wine.server";
import type { PhotoResult } from "../lib/stock/photo";
import { handlePhotoChange } from "../lib/stock/photo.server";
import { handleStockAction, loadStockPage, type StockPageData } from "../lib/stock/stock.server";

/** Stock : combien de bouteilles il reste de chaque vin ; ajouter du vin reçu ; corriger après un comptage ; nouveau vin. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<StockPageData> => {
  const { admin } = await authenticate.admin(request);
  return loadStockPage(admin);
};

export const action = async ({ request }: ActionFunctionArgs): Promise<StockActionResult | NewWineResult | PhotoResult> => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "nouveau_vin") return handleNewWine(admin, form);
  if (intent === "photo") return handlePhotoChange(admin, form);
  return handleStockAction(admin, form);
};

function SummaryBanner({ summary }: { readonly summary: StockSummary }) {
  if (summary.soldOut.length === 0 && summary.low.length === 0) {
    return <s-banner tone="success" heading="Tous les vins sont en stock." />;
  }
  return (
    <s-banner tone={summary.soldOut.length > 0 ? "critical" : "warning"} heading="Des vins sont à recommander">
      <s-stack direction="block" gap="small-200">
        {summary.soldOut.length === 0 ? null : <s-text>{`Plus en stock\u202F: ${summary.soldOut.join(", ")}`}</s-text>}
        {summary.low.length === 0 ? null : <s-text>{`Bientôt épuisés (un carton ou moins)\u202F: ${summary.low.join(", ")}`}</s-text>}
      </s-stack>
    </s-banner>
  );
}

export default function StockPage() {
  const data = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const shown = useMemo(() => filterStock(data.items, search), [data.items, search]);
  const summary = useMemo(() => stockSummary(data.items), [data.items]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const onCreated = useCallback((message: string) => {
    setCreating(false);
    setCreated(message);
  }, []);
  const authorized = data.canEdit && data.canCreateWines;

  return (
    <s-page heading="Stock" inlineSize="base">
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
          Le stock s’affiche, mais l’app ne peut pas encore le changer ni créer de vin. La personne qui s’occupe du site doit
          l’autoriser une seule fois dans Shopify ; ensuite, les boutons apparaîtront.
        </s-banner>
      )}
      {creating ? <NewWineForm onCreated={onCreated} onCancel={() => setCreating(false)} /> : null}
      {created === null ? null : <s-banner tone="success" heading={created} />}
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.loadError === null && data.items.length === 0 ? (
        <EmptyState heading="Aucun vin pour l’instant">Les vins mis en vente dans Shopify apparaîtront ici.</EmptyState>
      ) : null}
      {data.items.length === 0 ? null : (
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
            {shown.map((item) => (
              <StockRow key={item.variantId} item={item} canEdit={data.canEdit} canPhoto={data.canCreateWines} />
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
