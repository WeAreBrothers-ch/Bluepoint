import { FILL } from "./fill";
import { AGENDA_VIEWS } from "../lib/agenda/views";
import type { AgendaView } from "../lib/agenda/types";
import { TITRES } from "../lib/titres";

/**
 * Onglets de « Livraisons » : « Aujourd’hui », « Semaine », et « Toutes » qui ouvre « Toutes les commandes »
 * (l'historique, avec la recherche). Les mêmes onglets en haut de « Toutes les commandes » : on passe de l'un
 * à l'autre sans menu. Chaque onglet est un lien, la vue vit dans l'URL.
 */
export type LivraisonsTab = AgendaView | "toutes";

const TABS: readonly { readonly id: LivraisonsTab; readonly label: string; readonly href: string; readonly title: string }[] = [
  ...AGENDA_VIEWS.map((view) => ({ id: view.id, label: view.label, href: `/app?vue=${view.id}`, title: view.label })),
  { id: "toutes", label: "Toutes", href: "/app/commandes", title: TITRES.commandes },
];

export function AgendaTabs({ current }: { readonly current: LivraisonsTab }) {
  return (
    <s-grid gridTemplateColumns={`repeat(${TABS.length}, minmax(0, 1fr))`} gap="small-200">
      {TABS.map((tab) => {
        const isCurrent = tab.id === current;
        return (
          <s-button
            key={tab.id}
            {...FILL}
            href={tab.href}
            variant="secondary"
            {...(isCurrent ? { icon: "check" as const } : {})}
            accessibilityLabel={isCurrent ? `${tab.title}, vue affichée` : tab.title}
          >
            {tab.label}
          </s-button>
        );
      })}
    </s-grid>
  );
}
