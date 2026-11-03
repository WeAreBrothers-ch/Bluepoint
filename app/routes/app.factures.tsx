import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { FacturesPageView } from "../components/factures/FacturesPageView";
import { handleFacturesAction } from "../lib/factures/actions.server";
import { isFacturesView, type FacturesActionResult } from "../lib/factures/list-item";
import { loadFacturesPage, type FacturesPageData } from "../lib/factures/page-data.server";

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

export default function FacturesPage() {
  const data = useLoaderData<typeof loader>();
  return <FacturesPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
