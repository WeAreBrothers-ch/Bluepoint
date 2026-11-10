import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AbaNinjaPageView } from "../components/abaninja/AbaNinjaPageView";
import { runTrialAction } from "../lib/abaninja/trial-actions.server";
import { loadTrialPageStatus } from "../lib/abaninja/trial-status.server";
import type { TrialPageStatus } from "../lib/abaninja/trial-types";

/**
 * Page « Connexion AbaNinja » : un bouton qui lance un essai avec une facture fictive.
 * Le chargement n'appelle pas AbaNinja ; seul le bouton le fait, en POST.
 */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<TrialPageStatus> => {
  const { session } = await authenticate.admin(request);
  return loadTrialPageStatus(session.shop);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  if (request.method !== "POST") throw new Response(null, { status: 405 });
  const outcome = await runTrialAction(session.shop, await request.formData());
  return data(outcome.result, { status: outcome.status });
};

export default function AbaNinjaPage() {
  return <AbaNinjaPageView status={useLoaderData<typeof loader>()} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
