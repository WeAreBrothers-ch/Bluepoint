import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { EmptyState } from "../components/EmptyState";
import { InvoiceCard } from "../components/factures/InvoiceCard";
import { handleFacturesAction } from "../lib/factures/actions.server";
import {
  FACTURES_VIEWS,
  INVOICE_LIST_LIMIT,
  isFacturesView,
  type FacturesActionResult,
  type FacturesSummary,
  type FacturesView,
} from "../lib/factures/list-item";
import { loadFacturesPage, type FacturesPageData } from "../lib/factures/page-data.server";
import { formatChf } from "../lib/format/money";

/** Factures : qui doit de l'argent, combien, depuis quand ; envoyer, relancer, noter « payé ». */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<FacturesPageData> => {
  const { admin, session } = await authenticate.admin(request);
  const requested = new URL(request.url).searchParams.get("vue");
  return loadFacturesPage(admin, session.shop, isFacturesView(requested) ? requested : "a_encaisser", new Date());
};

export const action = async ({ request }: ActionFunctionArgs): Promise<FacturesActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  return handleFacturesAction(admin, session.shop, await request.formData());
};

function SummaryBanner({ summary }: { readonly summary: FacturesSummary }) {
  if (summary.unpaidCount === 0) return <s-banner tone="success" heading="Tout est payé. Personne ne vous doit d’argent." />;
  const heading = `À encaisser\u202F: ${formatChf(summary.unpaidCents)} (${summary.unpaidCount} facture${summary.unpaidCount > 1 ? "s" : ""})`;
  return (
    <s-banner tone={summary.overdueCount > 0 ? "warning" : "info"} heading={heading}>
      {summary.overdueCount > 0
        ? `Dont ${formatChf(summary.overdueCents)} en retard (${summary.overdueCount} facture${summary.overdueCount > 1 ? "s" : ""}), affichées en premier.`
        : "Aucune facture en retard."}
    </s-banner>
  );
}

function ViewTabs({ current }: { readonly current: FacturesView }) {
  return (
    <s-stack direction="inline" gap="small-200" accessibilityLabel="Factures affichées">
      {FACTURES_VIEWS.map((view) => (
        <s-button key={view.id} href={`/app/factures?vue=${view.id}`} variant={view.id === current ? "primary" : "secondary"}>
          {view.label}
        </s-button>
      ))}
    </s-stack>
  );
}

const EMPTY_TEXT: Readonly<Record<FacturesView, string>> = {
  a_encaisser: "Aucune facture à encaisser.",
  payees: "Aucune facture payée pour l’instant.",
  toutes: "Aucune facture pour l’instant.",
};

export default function FacturesPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Factures">
      {data.settingsComplete ? null : (
        <s-banner tone="warning" heading="Les nouvelles factures ne peuvent pas être faites">
          Il manque vos coordonnées ou votre compte bancaire. <s-link href="/app/reglages">Compléter mes coordonnées</s-link>
        </s-banner>
      )}
      {data.statusError === null ? null : <s-banner tone="warning" heading={data.statusError} />}
      <s-section>
        <s-stack direction="block" gap="base">
          <SummaryBanner summary={data.summary} />
          <ViewTabs current={data.view} />
        </s-stack>
      </s-section>
      {data.totalCount === 0 ? (
        <EmptyState heading="Aucune facture pour l’instant" action={<s-button href="/app">Aller à l’agenda</s-button>}>
          Les factures se font toutes seules quand vous touchez « C’est livré » dans l’agenda.
        </EmptyState>
      ) : data.invoices.length === 0 ? (
        <s-section>
          <s-paragraph>{EMPTY_TEXT[data.view]}</s-paragraph>
        </s-section>
      ) : (
        <s-section heading={`${FACTURES_VIEWS.find((view) => view.id === data.view)?.label ?? ""} (${data.invoices.length})`}>
          <s-stack direction="block" gap="base">
            {data.invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} emailConfigured={data.emailConfigured} />
            ))}
            {data.totalCount === INVOICE_LIST_LIMIT ? (
              <s-text color="subdued">{`Seules les ${INVOICE_LIST_LIMIT} dernières factures sont prises en compte.`}</s-text>
            ) : null}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
