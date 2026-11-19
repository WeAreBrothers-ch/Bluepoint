import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AbaNinjaPageView } from "../components/abaninja/AbaNinjaPageView";
import { loadFictitiousOrders, runDeliveryNoteTrialAction } from "../lib/abaninja/bl-essai-actions.server";
import { isDeliveryNoteTrialIntent } from "../lib/abaninja/bl-essai-form";
import type { FictitiousOrders } from "../lib/abaninja/bl-essai-order";
import { runTrialAction } from "../lib/abaninja/trial-actions.server";
import { loadTrialPageStatus } from "../lib/abaninja/trial-status.server";
import type { TrialPageStatus } from "../lib/abaninja/trial-types";

/**
 * Page « Connexion AbaNinja » : l'essai de connexion (facture fictive de 1 CHF) et l'essai
 * « bon de livraison → facture » sur une commande fictive. Le chargement n'appelle pas AbaNinja
 * (seulement Shopify, pour lister les commandes fictives) ; seuls les boutons le font, en POST.
 */

interface AbaNinjaPageData {
  readonly status: TrialPageStatus;
  readonly orders: FictitiousOrders;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<AbaNinjaPageData> => {
  const { admin, session } = await authenticate.admin(request);
  const [status, orders] = await Promise.all([loadTrialPageStatus(session.shop), loadFictitiousOrders(admin, session.shop)]);
  return { status, orders };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  if (request.method !== "POST") throw new Response(null, { status: 405 });
  const formData = await request.formData();
  if (isDeliveryNoteTrialIntent(formData)) {
    const outcome = await runDeliveryNoteTrialAction(admin, session.shop, formData);
    return data(outcome.result, { status: outcome.status });
  }
  const outcome = await runTrialAction(session.shop, formData);
  return data(outcome.result, { status: outcome.status });
};

export default function AbaNinjaPage() {
  const { status, orders } = useLoaderData<typeof loader>();
  return <AbaNinjaPageView status={status} orders={orders} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
