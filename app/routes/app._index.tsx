import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AgendaTabs } from "../components/AgendaTabs";
import { TodayView } from "../components/agenda/TodayView";
import { WeekView } from "../components/agenda/WeekView";
import { handleAgendaAction } from "../lib/agenda/actions.server";
import type { AgendaActionResult } from "../lib/agenda/action-result";
import { loadAgendaPage, type AgendaPageData } from "../lib/agenda/page-data.server";
import { AGENDA_MAX_ORDERS } from "../lib/agenda/query";
import { DEFAULT_AGENDA_VIEW, isAgendaView } from "../lib/agenda/views";

/** Agenda des livraisons : page d'accueil de l'app. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<AgendaPageData> => {
  const { admin, session } = await authenticate.admin(request);
  const requested = new URL(request.url).searchParams.get("vue");
  const view = isAgendaView(requested) ? requested : DEFAULT_AGENDA_VIEW;
  return loadAgendaPage(admin, session.shop, view, new Date());
};

export const action = async ({ request }: ActionFunctionArgs): Promise<AgendaActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  return handleAgendaAction(admin, session.shop, await request.formData());
};

function Notices({ data }: { readonly data: AgendaPageData }) {
  return (
    <>
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.truncated ? (
        <s-banner tone="warning" heading="Agenda incomplet">
          {`Seules les ${AGENDA_MAX_ORDERS} premières commandes sont affichées. Expédiez ou archivez les commandes terminées dans Shopify pour voir les autres.`}
        </s-banner>
      ) : null}
      {data.settingsComplete ? null : (
        <s-banner tone="info" heading="Une étape avant de pouvoir facturer">
          <s-stack direction="block" gap="small-200">
            <s-text>Renseignez vos coordonnées et votre compte bancaire pour créer des factures.</s-text>
            <s-button href="/app/reglages">Compléter les réglages</s-button>
          </s-stack>
        </s-banner>
      )}
    </>
  );
}

export default function AgendaPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Agenda">
      <s-button slot="primary-action" href="/app/commande" variant="primary">
        Nouvelle commande
      </s-button>
      <s-section>
        <s-stack direction="block" gap="base">
          <AgendaTabs current={data.view} />
          <s-text color="subdued">{data.periodLabel}</s-text>
        </s-stack>
      </s-section>
      <Notices data={data} />
      {data.view === "aujourdhui" ? (
        <TodayView groups={data.todayGroups} invoices={data.invoices} />
      ) : (
        <WeekView groups={data.weekGroups} invoices={data.invoices} />
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
