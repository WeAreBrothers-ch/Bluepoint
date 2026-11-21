import type { AbaNinjaClientsPageData } from "../../lib/clients-abaninja/page-data.server";
import type { ComparisonView } from "../../lib/clients-abaninja/view";
import { TITRES } from "../../lib/titres";
import { BatchButton } from "./BatchButton";
import { CardRow } from "./CardRow";
import { IgnoredLine, LinkedLine } from "./CompactLists";
import { GroupList, Paged } from "./GroupList";
import { ResultBanner } from "./ResultBanner";
import { AbsentActions, CandidateActions } from "./RowActions";
import { useClientsAction, useSuccessToast } from "./useClientsAction";

/**
 * Page « Clients AbaNinja » : chaque fiche AbaNinja comparée aux clients de la boutique, rangée par ce qu'il reste à décider.
 * Rien n'est changé dans AbaNinja et aucun e-mail n'est envoyé aux clients.
 */

const INTRO =
  "Les clients d’AbaNinja sont comparés à ceux de la boutique, par e-mail, par nom et par téléphone. Une fiche reliée ou créée ici retrouve son compte en se connectant à la boutique avec son e-mail. Rien n’est changé dans AbaNinja et aucun e-mail n’est envoyé aux clients.";

function Notices({ view, canCreate }: { readonly view: ComparisonView; readonly canCreate: boolean }) {
  return (
    <>
      {canCreate ? null : (
        <s-banner tone="warning" heading="Les sociétés ne peuvent pas encore devenir clients pro">
          {"Appelez la personne qui s’occupe de l’application\u202F: elle active cette autorisation une seule fois."}
        </s-banner>
      )}
      {view.truncated ? (
        <s-banner tone="warning" heading="La liste est coupée">
          Il y a trop de fiches pour les comparer toutes en une fois. Traitez celles-ci, puis rechargez la page.
        </s-banner>
      ) : null}
      {view.skipped === 0 ? null : (
        <s-banner tone="info" heading={`${view.skipped} fiche${view.skipped > 1 ? "s" : ""} d’AbaNinja illisible${view.skipped > 1 ? "s" : ""}`}>
          Elles ne sont pas montrées ici. Vérifiez-les dans AbaNinja.
        </s-banner>
      )}
    </>
  );
}

function Groups({ view }: { readonly view: ComparisonView }) {
  const { groups, counts, creatable } = view;
  return (
    <>
      <GroupList
        title="Même e-mail"
        hint={"Un seul client de la boutique a cet e-mail\u202F: c’est sans doute lui."}
        items={groups.meme_email}
        keyOf={(row) => row.card.uuid}
        batch={
          counts.meme_email > 1 ? (
            <BatchButton
              intent="relier_tous"
              label={`Relier les ${counts.meme_email} fiches`}
              question={`Relier les ${counts.meme_email} fiches à leur client\u202F?`}
              detail="Chaque fiche est reliée au client qui a le même e-mail. Les sociétés deviennent clients pro. Aucun e-mail n’est envoyé."
            />
          ) : undefined
        }
        render={(row) => (
          <CardRow card={row.card}>
            <CandidateActions row={row} sure />
          </CardRow>
        )}
      />
      <GroupList
        title="À vérifier"
        hint={"Même nom, même téléphone ou e-mail partagé\u202F: dites si c’est le même client."}
        items={groups.a_verifier}
        keyOf={(row) => row.card.uuid}
        render={(row) => (
          <CardRow card={row.card}>
            <CandidateActions row={row} sure={false} />
          </CardRow>
        )}
      />
      <GroupList
        title="Pas encore dans la boutique"
        hint={"Créez les clients\u202F; mettez de côté les fournisseurs et les fiches qui ne sont pas des clients."}
        items={groups.absent}
        keyOf={(row) => row.card.uuid}
        batch={
          creatable > 1 ? (
            <BatchButton
              intent="creer_tous"
              label={`Créer les ${creatable} fiches qui ont un e-mail`}
              question={`Créer ${creatable} clients dans la boutique\u202F?`}
              detail="Vérifiez d’abord qu’il n’y a pas de fournisseur dans la liste. Les sociétés deviennent clients pro. Aucun e-mail n’est envoyé."
            />
          ) : undefined
        }
        render={(row) => (
          <CardRow card={row.card}>
            <AbsentActions row={row} />
          </CardRow>
        )}
      />
      <s-section heading={`Déjà reliées (${counts.relie})`}>
        {counts.relie === 0 ? <s-paragraph>Aucune fiche reliée pour l’instant.</s-paragraph> : null}
        <Paged items={groups.relie} keyOf={(row) => row.card.uuid} render={(row) => <LinkedLine row={row} />} />
      </s-section>
      {counts.ignore === 0 ? null : (
        <s-section heading={`Mises de côté (${counts.ignore})`}>
          <s-paragraph>Elles ne seront pas reprises dans la boutique.</s-paragraph>
          <Paged items={groups.ignore} keyOf={(row) => row.card.uuid} render={(row) => <IgnoredLine row={row} />} />
        </s-section>
      )}
    </>
  );
}

export function AbaNinjaClientsPageView({ data }: { readonly data: AbaNinjaClientsPageData }) {
  const action = useClientsAction();
  useSuccessToast(action.result);
  const orphan = action.result !== undefined && action.result.fiche === null && action.result.intent === null ? action.result : undefined;
  return (
    <s-page heading={TITRES.clientsAbaninja} inlineSize="base">
      <s-button slot="secondary-actions" href="/app/clients">
        Retour aux clients
      </s-button>
      {data.state === "erreur" ? (
        <s-banner tone="critical" heading="La comparaison n’a pas pu être faite">
          <s-stack direction="block" gap="small-200">
            <s-text>{data.message}</s-text>
            <s-stack direction="inline">
              <s-button href="/app/clients/abaninja">Réessayer</s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      ) : (
        <>
          <s-section>
            <s-paragraph>{INTRO}</s-paragraph>
          </s-section>
          <ResultBanner result={orphan} />
          <Notices view={data.view} canCreate={data.canCreate} />
          <Groups view={data.view} />
        </>
      )}
    </s-page>
  );
}
