import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { ProsPageView } from "../components/pros/ProsPageView";
import { handleProsAction } from "../lib/pros/actions.server";
import { loadProsPage, type ProsPageData } from "../lib/pros/page-data.server";
import type { ProsActionResult } from "../lib/pros/view";

/**
 * Clients pro (/app/clients/pros) : demandes reçues par le site à accepter, et ajout direct d'un pro qui appelle.
 * Sous « /app/clients » pour que le menu de Shopify surligne « Clients » (et non « Livraisons ») sur cette page.
 */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<ProsPageData> => {
  const { admin, session } = await authenticate.admin(request);
  return loadProsPage(admin, session.shop);
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ProsActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  return handleProsAction(admin, session.shop, await request.formData());
};

export default function ClientsProPage() {
  const data = useLoaderData<typeof loader>();
  return <ProsPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
