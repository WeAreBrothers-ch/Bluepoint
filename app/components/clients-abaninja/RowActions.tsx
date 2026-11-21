import type { AbsentRow, CandidatesRow, ClientView } from "../../lib/clients-abaninja/view";
import { ClientKindBadge } from "../ClientKindBadge";
import { FILL } from "../fill";
import { ResultBanner } from "./ResultBanner";
import { useClientsAction, type ClientsAction } from "./useClientsAction";

/** Les boutons d'une fiche : relier à un client, dire que ce n'est pas lui, créer, mettre de côté. */

const PRO_NOTE = "Relier en fait un client pro, avec paiement sur facture. Aucun e-mail ne lui est envoyé.";

function spinning(action: ClientsAction, intent: string, fiche: string, client: string | null = null) {
  const mine = action.pendingIntent === intent && action.pendingFiche === fiche && action.pendingClient === client;
  return { ...(mine ? { loading: true } : {}), ...(action.busy ? { disabled: true } : {}) };
}

function resultFor(action: ClientsAction, fiche: string) {
  return action.result?.fiche === fiche ? action.result : undefined;
}

function CandidateBox({ fiche, client, sure }: { readonly fiche: string; readonly client: ClientView; readonly sure: boolean }) {
  const action = useClientsAction();
  const send = (intent: "relier" | "pas_lui") => action.submit({ intent, fiche, client: client.customerId });
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text color="subdued">Client de la boutique</s-text>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{client.name}</s-text>
          <ClientKindBadge isPro={client.isPro} />
        </s-stack>
        {client.email === null ? null : <s-text>{client.email}</s-text>}
        {client.place === null ? null : <s-text>{client.place}</s-text>}
        <s-stack direction="inline" gap="small-200">
          {client.reasons.map((reason) => (
            <s-badge key={reason} tone="info">
              {reason}
            </s-badge>
          ))}
        </s-stack>
        <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
          <s-button {...FILL} variant="primary" icon="link" onClick={() => send("relier")} {...spinning(action, "relier", fiche, client.customerId)}>
            {sure ? "Relier à ce client" : "Oui, c’est le même client"}
          </s-button>
          <s-button {...FILL} icon="x" onClick={() => send("pas_lui")} {...spinning(action, "pas_lui", fiche, client.customerId)}>
            Non, ce n’est pas lui
          </s-button>
        </s-grid>
      </s-stack>
    </s-box>
  );
}

/** « Même e-mail » (sure) ou « À vérifier » : un encadré par client possible. */
export function CandidateActions({ row, sure }: { readonly row: CandidatesRow; readonly sure: boolean }) {
  const action = useClientsAction();
  return (
    <s-stack direction="block" gap="base">
      {row.card.isCompany ? <s-text color="subdued">{PRO_NOTE}</s-text> : null}
      {row.candidates.map((client) => (
        <CandidateBox key={client.customerId} fiche={row.card.uuid} client={client} sure={sure} />
      ))}
      <ResultBanner result={resultFor(action, row.card.uuid)} />
    </s-stack>
  );
}

export function AbsentActions({ row }: { readonly row: AbsentRow }) {
  const action = useClientsAction();
  const fiche = row.card.uuid;
  return (
    <s-stack direction="block" gap="small-200">
      {row.canCreate ? <s-text color="subdued">{row.note}</s-text> : <s-banner tone="warning" heading={row.note} />}
      <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
        {row.canCreate ? (
          <s-button {...FILL} variant="primary" icon="plus" onClick={() => action.submit({ intent: "creer", fiche })} {...spinning(action, "creer", fiche)}>
            Créer dans la boutique
          </s-button>
        ) : null}
        <s-button {...FILL} onClick={() => action.submit({ intent: "ignorer", fiche })} {...spinning(action, "ignorer", fiche)}>
          Mettre de côté (pas un client)
        </s-button>
      </s-grid>
      <ResultBanner result={resultFor(action, fiche)} />
    </s-stack>
  );
}

export function RestoreButton({ fiche, name }: { readonly fiche: string; readonly name: string }) {
  const action = useClientsAction();
  return (
    <s-button icon="undo" accessibilityLabel={`Remettre ${name} dans la liste`} onClick={() => action.submit({ intent: "remettre", fiche })} {...spinning(action, "remettre", fiche)}>
      Remettre
    </s-button>
  );
}
