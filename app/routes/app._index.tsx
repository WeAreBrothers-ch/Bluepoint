import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AgendaPageView } from "../components/agenda/AgendaPageView";
import { handleAgendaAction } from "../lib/agenda/actions.server";
import type { AgendaActionResult } from "../lib/agenda/action-result";
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

export default function AgendaPage() {
  const data = useLoaderData<typeof loader>();
  return <AgendaPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
