import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { RecapSheet } from "../components/litres/RecapSheet";
import { loadLitresPage, type LitresPageData } from "../lib/litres/report.server";

/** Feuille de récapitulatif des litres vendus, à imprimer : /app/litres/feuille?annee=2026 */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LitresPageData> => {
  const { admin, session } = await authenticate.admin(request);
  return loadLitresPage(admin, session.shop, new URL(request.url).searchParams.get("annee"), new Date());
};

export default function RecapSheetPage() {
  return <RecapSheet data={useLoaderData<typeof loader>()} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
