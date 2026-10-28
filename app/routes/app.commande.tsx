import { useCallback, useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { OrderOutcomeBanner } from "../components/commande/OrderOutcomeBanner";
import { PhoneOrderForm } from "../components/commande/PhoneOrderForm";
import type { Submission } from "../components/commande/usePhoneOrder";
import { handleCommandeAction, type CommandeActionResult } from "../lib/commande/action.server";
import type { PhoneOrderOutcome } from "../lib/commande/outcome";
import { loadCommandePage, type CommandePageData } from "../lib/commande/page-data.server";

/** Saisie d'une commande reçue par téléphone : elle est créée dans Shopify et apparaît dans l'agenda. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<CommandePageData> => {
  const { admin, session } = await authenticate.admin(request);
  return loadCommandePage(admin, session.shop, new Date());
};

export const action = async ({ request }: ActionFunctionArgs): Promise<CommandeActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  return handleCommandeAction(admin, session.shop, request);
};

/** Le formulaire est remonté à neuf (vidé) après chaque commande créée. */
function formKey(outcome: PhoneOrderOutcome | undefined): string {
  if (outcome?.kind === "commande") return outcome.orderId;
  if (outcome?.kind === "brouillon") return outcome.draftOrderId;
  return "saisie";
}

function useCreateOrder() {
  const fetcher = useFetcher<CommandeActionResult>({ key: "commande-creer" });
  const { submit } = fetcher;
  const outcome = fetcher.data?.intent === "creer" ? fetcher.data.outcome : undefined;
  const onSubmit = useCallback(
    (submission: Submission) => submit(submission, { method: "post", encType: "application/json" }),
    [submit],
  );

  useEffect(() => {
    if (outcome?.kind === "commande" && !outcome.replayed) shopify.toast.show(`Commande ${outcome.orderName} créée`);
  }, [outcome]);

  return { outcome, onSubmit, submitting: fetcher.state !== "idle" };
}

export default function NouvelleCommandePage() {
  const data = useLoaderData<typeof loader>();
  const { outcome, onSubmit, submitting } = useCreateOrder();

  return (
    <s-page heading="Nouvelle commande (téléphone)" inlineSize="base">
      <s-button slot="secondary-actions" href="/app">
        Agenda
      </s-button>
      <s-stack direction="block" gap="base">
        {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
        {outcome === undefined ? null : <OrderOutcomeBanner outcome={outcome} />}
        <PhoneOrderForm
          key={formKey(outcome)}
          products={data.products}
          truncated={data.truncated}
          paymentTermDays={data.paymentTermDays}
          today={data.today}
          outcome={outcome}
          submitting={submitting}
          onSubmit={onSubmit}
        />
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
