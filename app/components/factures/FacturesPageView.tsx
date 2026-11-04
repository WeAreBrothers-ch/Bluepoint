import { TITRES } from "../../lib/titres";
import { formatChf } from "../../lib/format/money";
import {
  FACTURES_VIEWS,
  INVOICE_LIST_LIMIT,
  type FacturesSummary,
  type FacturesView,
} from "../../lib/factures/list-item";
import type { FacturesPageData } from "../../lib/factures/page-data.server";
import { EmptyState } from "../EmptyState";
import { GroupTitle } from "../GroupTitle";
import { FILL } from "../fill";
import { InvoiceCard } from "./InvoiceCard";

/** Page « Factures » : la partie visible, séparée de la route pour pouvoir être affichée seule (aperçu, tests). */

function SummaryBanner({ summary }: { readonly summary: FacturesSummary }) {
  if (summary.unpaidCount === 0) return <s-banner tone="success" heading="Tout est payé. Personne ne vous doit d’argent." />;
  const plural = summary.unpaidCount > 1 ? "s" : "";
  const late =
    summary.overdueCount > 0
      ? `, dont ${formatChf(summary.overdueCents)} en retard (${summary.overdueCount} facture${summary.overdueCount > 1 ? "s" : ""})`
      : "";
  return (
    <s-banner tone={summary.overdueCount > 0 ? "warning" : "info"} heading={`On vous doit ${formatChf(summary.unpaidCents)}`}>
      {`${summary.unpaidCount} facture${plural} pas encore payée${plural}${late}.`}
    </s-banner>
  );
}

function ViewTabs({ current }: { readonly current: FacturesView }) {
  return (
    <s-grid gridTemplateColumns={`repeat(${FACTURES_VIEWS.length}, minmax(0, 1fr))`} gap="small-200">
      {FACTURES_VIEWS.map((view) => (
        <s-button
          key={view.id}
          {...FILL}
          href={`/app/factures?vue=${view.id}`}
          variant={view.id === current ? "primary" : "secondary"}
          accessibilityLabel={view.title}
        >
          {view.label}
        </s-button>
      ))}
    </s-grid>
  );
}

const EMPTY_TEXT: Readonly<Record<FacturesView, string>> = {
  a_encaisser: "Aucune facture en attente de paiement.",
  payees: "Aucune facture payée pour l’instant.",
  toutes: "Aucune facture pour l’instant.",
};

export function FacturesPageView({ data }: { readonly data: FacturesPageData }) {
  return (
    <s-page heading={TITRES.factures} inlineSize="base">
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
        <EmptyState heading="Aucune facture pour l’instant" action={<s-button href="/app">Voir les livraisons</s-button>}>
          Les factures se font toutes seules quand vous touchez « J’ai livré la commande » dans « Livraisons ».
        </EmptyState>
      ) : data.invoices.length === 0 ? (
        <s-section>
          <s-paragraph>{EMPTY_TEXT[data.view]}</s-paragraph>
        </s-section>
      ) : (
        <>
          <GroupTitle title={`${FACTURES_VIEWS.find((view) => view.id === data.view)?.title ?? ""} (${data.invoices.length})`} />
          {data.invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} emailConfigured={data.emailConfigured} />
          ))}
          {data.totalCount === INVOICE_LIST_LIMIT ? (
            <s-text color="subdued">{`Seules les ${INVOICE_LIST_LIMIT} dernières factures sont prises en compte.`}</s-text>
          ) : null}
        </>
      )}
    </s-page>
  );
}
