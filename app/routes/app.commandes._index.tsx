import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { OrdersPageView } from "../components/commandes/OrdersPageView";
import { DEFAULT_ORDERS_TAB, isOrdersTab } from "../lib/commandes/list";
import { loadOrdersPage, type OrdersPageData } from "../lib/commandes/list.server";

/** Commandes : retrouver une commande passée (client, numéro, état) et l'ouvrir dans l'app. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<OrdersPageData> => {
  const { admin } = await authenticate.admin(request);
  const params = new URL(request.url).searchParams;
  const tab = params.get("onglet");
  return loadOrdersPage(admin, isOrdersTab(tab) ? tab : DEFAULT_ORDERS_TAB, params.get("q") ?? "", params.get("apres"), new Date());
};

export default function CommandesPage() {
  const data = useLoaderData<typeof loader>();
  return <OrdersPageView data={data} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
