import { FILL } from "./fill";
import { AGENDA_VIEWS } from "../lib/agenda/views";
import type { AgendaView } from "../lib/agenda/types";

/** Onglets « Aujourd’hui / Semaine » : chaque onglet est un lien, la vue vit dans l'URL. */
interface AgendaTabsProps {
  readonly current: AgendaView;
}

export function AgendaTabs({ current }: AgendaTabsProps) {
  return (
    <s-grid gridTemplateColumns={`repeat(${AGENDA_VIEWS.length}, minmax(0, 1fr))`} gap="small-200">
      {AGENDA_VIEWS.map((view) => {
        const isCurrent = view.id === current;
        return (
          <s-button
            key={view.id}
            {...FILL}
            href={`/app?vue=${view.id}`}
            variant={isCurrent ? "primary" : "secondary"}
            accessibilityLabel={isCurrent ? `${view.label}, vue affichée` : view.label}
          >
            {view.label}
          </s-button>
        );
      })}
    </s-grid>
  );
}
