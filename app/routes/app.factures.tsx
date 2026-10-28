import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { EmptyState } from "../components/EmptyState";
import { InvoiceCard } from "../components/factures/InvoiceCard";
import { handleFacturesAction } from "../lib/factures/actions.server";
import { INVOICE_LIST_LIMIT, type FacturesActionResult } from "../lib/factures/list-item";
import { loadFacturesPage, type FacturesPageData } from "../lib/factures/page-data.server";

/** Factures avec QR-facture suisse, créées à la livraison des commandes. */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<FacturesPageData> => {
  const { session } = await authenticate.admin(request);
  return loadFacturesPage(session.shop, new Date());
};

export const action = async ({ request }: ActionFunctionArgs): Promise<FacturesActionResult> => {
  const { session } = await authenticate.admin(request);
  return handleFacturesAction(session.shop, await request.formData());
};

export default function FacturesPage() {
  const { invoices, emailConfigured, settingsComplete } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Factures">
      {settingsComplete ? null : (
        <s-banner tone="warning" heading="Réglages de facturation incomplets">
          Aucune nouvelle facture ne peut être créée. <s-link href="/app/reglages">Compléter les réglages</s-link>
        </s-banner>
      )}
      {invoices.length === 0 ? (
        <EmptyState heading="Aucune facture pour l’instant">
          Une facture PDF avec QR-facture est créée quand une commande est marquée livrée dans l’agenda.
        </EmptyState>
      ) : (
        <s-section heading={`Dernières factures (${invoices.length})`}>
          <s-stack direction="block" gap="base">
            {invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} emailConfigured={emailConfigured} />
            ))}
            {invoices.length === INVOICE_LIST_LIMIT ? (
              <s-text color="subdued">{`Seules les ${INVOICE_LIST_LIMIT} dernières factures sont affichées.`}</s-text>
            ) : null}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
