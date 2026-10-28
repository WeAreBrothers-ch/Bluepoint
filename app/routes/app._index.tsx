import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AgendaTabs } from "../components/AgendaTabs";
import { TodayView } from "../components/agenda/TodayView";
import { WeekNavigationButtons } from "../components/agenda/WeekNavigationButtons";
import { WeekView } from "../components/agenda/WeekView";
import { handleAgendaAction } from "../lib/agenda/actions.server";
import type { AgendaActionResult } from "../lib/agenda/action-result";
import { capitalize } from "../lib/agenda/dates";
import { loadAgendaPage, type AgendaPageData } from "../lib/agenda/page-data.server";
import { DEFAULT_AGENDA_VIEW, isAgendaView } from "../lib/agenda/views";

/** Agenda des livraisons : page d'accueil de l'app. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<AgendaPageData> => {
  const { admin, session } = await authenticate.admin(request);
  const params = new URL(request.url).searchParams;
  const requested = params.get("vue");
  const view = isAgendaView(requested) ? requested : DEFAULT_AGENDA_VIEW;
  return loadAgendaPage(admin, session.shop, view, new Date(), params.get("semaine"));
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
        <s-banner tone="warning" heading="Certaines commandes ne sont pas affichées">
          Il y a trop de commandes en cours pour toutes les montrer. Les plus anciennes déjà livrées peuvent être archivées
          dans Shopify.
        </s-banner>
      ) : null}
      {data.pendingProRequests === 0 ? null : (
        <s-banner
          tone="info"
          heading={`${data.pendingProRequests} demande${data.pendingProRequests > 1 ? "s" : ""} de compte pro à valider`}
        >
          <s-stack direction="block" gap="small-200">
            <s-text>Un professionnel a demandé à commander avec les prix pros.</s-text>
            <s-stack direction="inline">
              <s-button href="/app/pros">Voir les demandes</s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      )}
      {data.settingsComplete ? null : (
        <s-banner tone="info" heading="Les factures ne peuvent pas encore être faites">
          <s-stack direction="block" gap="small-200">
            <s-text>Il manque vos coordonnées ou votre compte bancaire.</s-text>
            <s-button href="/app/reglages">Compléter mes coordonnées</s-button>
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
        Prendre une commande
      </s-button>
      <s-section>
        <s-stack direction="block" gap="base">
          <AgendaTabs current={data.view} />
          <s-heading>{capitalize(data.periodLabel)}</s-heading>
          {data.view === "semaine" ? <WeekNavigationButtons navigation={data.weekNavigation} /> : null}
        </s-stack>
      </s-section>
      <Notices data={data} />
      {data.view === "aujourdhui" ? (
        <TodayView groups={data.todayGroups} invoices={data.invoices} today={data.today} emailConfigured={data.emailConfigured} />
      ) : (
        <WeekView groups={data.weekGroups} invoices={data.invoices} today={data.today} emailConfigured={data.emailConfigured} />
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
