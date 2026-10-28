import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { AddProForm } from "../components/pros/AddProForm";
import { ProRequestCard } from "../components/pros/ProRequestCard";
import { handleProsAction } from "../lib/pros/actions.server";
import { loadProsPage, type ProsPageData } from "../lib/pros/page-data.server";
import type { ProsActionResult } from "../lib/pros/view";

/** Clients pro : demandes reçues par le site à accepter, et ajout direct d'un pro qui appelle. */

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

  return (
    <s-page heading="Clients pro" inlineSize="base">
      {data.canCreate ? null : (
        <s-banner tone="warning" heading="Une étape d’autorisation reste à faire">
          Les demandes arrivent déjà ici, mais l’app ne peut pas encore créer les comptes pro dans Shopify. La personne qui
          s’occupe du site doit l’autoriser une seule fois ; ensuite, le bouton « Accepter » fonctionnera.
        </s-banner>
      )}
      <s-section heading={`Demandes à valider (${data.pending.length})`}>
        {data.pending.length === 0 ? (
          <s-paragraph>Aucune demande à valider. Les demandes envoyées depuis le site apparaissent ici.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {data.pending.map((request) => (
              <ProRequestCard key={request.id} request={request} canCreate={data.canCreate} />
            ))}
          </s-stack>
        )}
      </s-section>
      <s-section heading="Ajouter un client pro">
        <s-stack direction="block" gap="base">
          <s-paragraph>Un pro vous appelle pour ouvrir un compte ? Créez-le ici directement, sans passer par le site.</s-paragraph>
          <AddProForm canCreate={data.canCreate} />
        </s-stack>
      </s-section>
      <s-section heading="Le formulaire du site">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Les pros demandent leur compte avec le formulaire « Devenir client pro » du site. Ajoutez un lien vers cette
            page dans le menu du site.
          </s-paragraph>
          <s-text color="subdued">{data.formUrl}</s-text>
          <s-stack direction="inline">
            <s-button href={data.formUrl} target="_blank" icon="external">
              Voir le formulaire
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>
      {data.decided.length === 0 ? null : (
        <s-section heading="Dernières réponses">
          <s-stack direction="block" gap="small-200">
            {data.decided.map((request) => (
              <s-stack key={request.id} direction="inline" gap="small-200" alignItems="center">
                <s-badge tone={request.accepted ? "success" : "neutral"}>{request.accepted ? "Acceptée" : "Refusée"}</s-badge>
                <s-text>{`${request.companyName} — ${request.personName}`}</s-text>
                <s-text color="subdued">{request.decisionLabel ?? ""}</s-text>
              </s-stack>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
