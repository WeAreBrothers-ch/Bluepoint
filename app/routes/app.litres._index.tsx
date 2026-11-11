import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { LitresPageView } from "../components/litres/LitresPageView";
import type { WineInfoResult } from "../lib/litres/info-form";
import { handleWineInfo } from "../lib/litres/info.server";
import { loadLitresPage, type LitresPageData } from "../lib/litres/report.server";

/** Litres vendus : combien de litres de vin ont été vendus dans l'année, et la feuille à imprimer. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<LitresPageData> => {
  const { admin, session } = await authenticate.admin(request);
  return loadLitresPage(admin, session.shop, new URL(request.url).searchParams.get("annee"), new Date());
};

export const action = async ({ request }: ActionFunctionArgs): Promise<WineInfoResult> => {
  const { admin } = await authenticate.admin(request);
  return handleWineInfo(admin, await request.formData());
};

export default function LitresPage() {
  return <LitresPageView data={useLoaderData<typeof loader>()} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
