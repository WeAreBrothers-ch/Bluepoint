import { useCallback, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { OrderChangeSection, OrderEditor } from "../components/commandes/OrderChange";
import { OrderCustomer, OrderWines } from "../components/commandes/OrderSections";
import { OrderSummary } from "../components/commandes/OrderSummary";
import { handleAgendaAction } from "../lib/agenda/actions.server";
import type { AgendaActionResult } from "../lib/agenda/action-result";
import { isOrderChangeIntent, type OrderChangeResult } from "../lib/commandes/change";
import { handleOrderChange } from "../lib/commandes/change.server";
import { loadOrderPage, type OrderPageData } from "../lib/commandes/detail.server";

/**
 * Fiche d'une commande, ouverte depuis l'agenda : quand, quoi faire, les vins et les prix,
 * le client, la facture. Mêmes boutons que la carte de l'agenda, pour ne jamais devoir passer par Shopify.
 */

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<OrderPageData> => {
  const { admin, session } = await authenticate.admin(request);
  return loadOrderPage(admin, session.shop, params.id ?? "", new Date());
};

export const action = async ({ request }: ActionFunctionArgs): Promise<AgendaActionResult | OrderChangeResult> => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  // « Modifier les vins » et « Annuler la commande » ; le reste vient des boutons de l'agenda.
  return isOrderChangeIntent(form.get("intent")) ? handleOrderChange(admin, form) : handleAgendaAction(admin, session.shop, form);
};

export default function CommandePage() {
  const data = useLoaderData<typeof loader>();
  const { detail, change } = data;
  const [editing, setEditing] = useState(false);
  const closeEditor = useCallback(() => setEditing(false), []);
  const canEdit = change?.rules.canEdit === true;

  return (
    <s-page heading={detail === null ? "Commande" : `Commande ${detail.task.name}`} inlineSize="base">
      <s-button slot="secondary-actions" href="/app">
        Retour à l’agenda
      </s-button>
      {detail === null ? (
        <s-banner tone="warning" heading={data.problem ?? "Cette commande n’existe pas."}>
          <s-button href="/app">Retour à l’agenda</s-button>
        </s-banner>
      ) : (
        <>
          <OrderSummary detail={detail} invoice={data.invoice} today={data.today} emailConfigured={data.emailConfigured} />
          {editing && canEdit && change !== null ? (
            <OrderEditor detail={detail} products={change.products} truncated={change.truncated} onClose={closeEditor} />
          ) : (
            <OrderWines detail={detail} />
          )}
          {change === null || !change.rules.changeable || editing ? null : (
            <OrderChangeSection detail={detail} rules={change.rules} onEdit={() => setEditing(true)} />
          )}
          <OrderCustomer detail={detail} />
          {detail.orderedLabel === "" ? null : (
            <s-section>
              <s-text color="subdued">{detail.orderedLabel}</s-text>
            </s-section>
          )}
        </>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
