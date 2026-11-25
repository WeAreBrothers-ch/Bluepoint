import type { AutoReason, IgnoredRow, LinkedRow } from "../../lib/clients-abaninja/view";
import { cardSubtitle } from "./CardRow";
import { ResultBanner } from "./ResultBanner";
import { FinishButton, RestoreButton } from "./RowActions";
import { useClientsAction } from "./useClientsAction";

/** « Déjà reliées » et « Mises de côté » : une ligne par fiche, sans carte (rien à décider). */

export function LinkedLine({ row }: { readonly row: LinkedRow }) {
  const action = useClientsAction();
  return (
    <s-box paddingBlock="small-200">
      <s-stack direction="block" gap="small-200">
        <s-stack direction="block" gap="small-100">
          <s-text type="strong">{row.card.name}</s-text>
          <s-text color="subdued">{`${cardSubtitle(row.card)} → ${row.client.name}${row.client.email === null ? "" : ` (${row.client.email})`}`}</s-text>
        </s-stack>
        {row.toFinish ? (
          <s-banner tone="warning" heading="Compte pro pas terminé">
            <s-stack direction="block" gap="small-200">
              <s-text>Il lui manque l’étiquette pro ou son rôle dans l’entreprise. Rien ne sera créé en double.</s-text>
              <s-stack direction="inline">
                <FinishButton fiche={row.card.uuid} client={row.client.customerId} />
              </s-stack>
            </s-stack>
          </s-banner>
        ) : null}
        <ResultBanner result={action.result?.fiche === row.card.uuid ? action.result : undefined} />
      </s-stack>
    </s-box>
  );
}

const AUTO_REASON_TEXT: Readonly<Record<AutoReason, string>> = {
  prives: "Fiche des ventes aux particuliers\u202F: jamais reprise",
  archivee: "Archivée dans AbaNinja\u202F: pas reprise. Désarchivez-la dans AbaNinja pour la reprendre.",
};

export function IgnoredLine({ row }: { readonly row: IgnoredRow }) {
  const action = useClientsAction();
  return (
    <s-box paddingBlock="small-200">
      <s-stack direction="block" gap="small-200">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">{row.card.name}</s-text>
            <s-text color="subdued">{row.autoReason === null ? cardSubtitle(row.card) : AUTO_REASON_TEXT[row.autoReason]}</s-text>
          </s-stack>
          {row.autoReason === null ? <RestoreButton fiche={row.card.uuid} name={row.card.name} /> : null}
        </s-grid>
        <ResultBanner result={action.result?.fiche === row.card.uuid ? action.result : undefined} />
      </s-stack>
    </s-box>
  );
}
