import type { AgendaView } from "./types";

/** Libellés et ordre des onglets de l'agenda. */
export const AGENDA_VIEWS: readonly { readonly id: AgendaView; readonly label: string }[] = [
  { id: "aujourdhui", label: "Aujourd’hui" },
  { id: "semaine", label: "Semaine" },
];

export const DEFAULT_AGENDA_VIEW: AgendaView = "aujourdhui";

export function isAgendaView(value: unknown): value is AgendaView {
  return AGENDA_VIEWS.some((view) => view.id === value);
}
