import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ClientsPageView } from "../components/clients/ClientsPageView";
import { DEFAULT_CLIENTS_TAB, isClientsTab } from "../lib/clients/list";
import { loadClientsPage, type ClientsPageData } from "../lib/clients/list.server";
import { countPendingProRequests } from "../lib/pros/repository.server";

/** Clients : retrouver un client, ouvrir sa fiche, en créer un. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<ClientsPageData> => {
  const { admin, session } = await authenticate.admin(request);
  const params = new URL(request.url).searchParams;
  const tab = params.get("onglet");
  return loadClientsPage(
    admin,
    isClientsTab(tab) ? tab : DEFAULT_CLIENTS_TAB,
    params.get("q") ?? "",
    params.get("apres"),
    await countPendingProRequests(session.shop),
  );
};

export default function ClientsPage() {
  const data = useLoaderData<typeof loader>();
  return <ClientsPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
