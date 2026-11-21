import type { IgnoredRow, LinkedRow } from "../../lib/clients-abaninja/view";
import { cardSubtitle } from "./CardRow";
import { ResultBanner } from "./ResultBanner";
import { RestoreButton } from "./RowActions";
import { useClientsAction } from "./useClientsAction";

/** « Déjà reliées » et « Mises de côté » : une ligne par fiche, sans carte (rien à décider). */

export function LinkedLine({ row }: { readonly row: LinkedRow }) {
  return (
    <s-box paddingBlock="small-200">
      <s-stack direction="block" gap="small-100">
        <s-text type="strong">{row.card.name}</s-text>
        <s-text color="subdued">{`${cardSubtitle(row.card)} → ${row.client.name}${row.client.email === null ? "" : ` (${row.client.email})`}`}</s-text>
      </s-stack>
    </s-box>
  );
}

export function IgnoredLine({ row }: { readonly row: IgnoredRow }) {
  const action = useClientsAction();
  return (
    <s-box paddingBlock="small-200">
      <s-stack direction="block" gap="small-200">
        <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
          <s-stack direction="block" gap="small-100">
            <s-text type="strong">{row.card.name}</s-text>
            <s-text color="subdued">{row.auto ? "Fiche des ventes aux particuliers\u202F: jamais reprise" : cardSubtitle(row.card)}</s-text>
          </s-stack>
          {row.auto ? null : <RestoreButton fiche={row.card.uuid} name={row.card.name} />}
        </s-grid>
        <ResultBanner result={action.result?.fiche === row.card.uuid ? action.result : undefined} />
      </s-stack>
    </s-box>
  );
}
