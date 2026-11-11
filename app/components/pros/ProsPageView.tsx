import { TITRES } from "../../lib/titres";
import type { ProsPageData } from "../../lib/pros/page-data.server";
import { GroupTitle } from "../GroupTitle";
import { AddProForm } from "./AddProForm";
import { ProRequestCard } from "./ProRequestCard";

/** Page « Clients pro » : la partie visible, séparée de la route pour pouvoir être affichée seule (aperçu, tests). */

export function ProsPageView({ data }: { readonly data: ProsPageData }) {
  return (
    <s-page heading={TITRES.clientsPro} inlineSize="base">
      <s-button slot="secondary-actions" href="/app/clients">
        Retour aux clients
      </s-button>
      {data.canCreate ? null : (
        <s-banner tone="warning" heading="Accepter une demande n’est pas encore activé">
          Les demandes arrivent déjà ici. Pour pouvoir les accepter, appelez la personne qui s’occupe de l’application : elle l’active une
          seule fois.
        </s-banner>
      )}
      {data.pending.length === 0 ? (
        <s-section heading="Demandes à valider (0)">
          <s-paragraph>Aucune demande à valider. Les demandes envoyées depuis le site apparaissent ici.</s-paragraph>
        </s-section>
      ) : (
        <>
          <GroupTitle title={`Demandes à valider (${data.pending.length})`} />
          {data.pending.map((request) => (
            <ProRequestCard key={request.id} request={request} canCreate={data.canCreate} />
          ))}
        </>
      )}
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
