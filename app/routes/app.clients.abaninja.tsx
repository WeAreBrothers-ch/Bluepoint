import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AbaNinjaClientsPageView } from "../components/clients-abaninja/AbaNinjaClientsPageView";
import { handleAbaNinjaClientsAction, type ClientsAbaNinjaResult } from "../lib/clients-abaninja/actions.server";
import { loadAbaNinjaClientsPage, type AbaNinjaClientsPageData } from "../lib/clients-abaninja/page-data.server";

/**
 * Clients AbaNinja (/app/clients/abaninja) : relier les fiches AbaNinja aux clients de la boutique, ou les y créer.
 * Sous « /app/clients » pour que le menu de Shopify surligne « Clients » sur cette page.
 */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<AbaNinjaClientsPageData> => {
  const { admin } = await authenticate.admin(request);
  return loadAbaNinjaClientsPage(admin);
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ClientsAbaNinjaResult> => {
  const { admin, session } = await authenticate.admin(request);
  return handleAbaNinjaClientsAction(admin, session.shop, await request.formData());
};

export default function ClientsAbaNinjaPage() {
  const data = useLoaderData<typeof loader>();
  return <AbaNinjaClientsPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
