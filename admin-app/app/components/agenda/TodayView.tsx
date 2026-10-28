import type { TodayGroups } from "../../lib/agenda/grouping";
import type { InvoiceRef } from "../../lib/agenda/types";
import { EmptyState } from "../EmptyState";
import { TaskList } from "./TaskList";

/** Vue « Aujourd’hui » : retards en tête, puis livraisons du jour, sans date, déjà livrées. */

interface TodayViewProps {
  readonly groups: TodayGroups;
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
}

export function TodayView({ groups, invoices }: TodayViewProps) {
  const lateCount = groups.due.filter((task) => task.urgency === "en_retard").length;
  if (groups.due.length + groups.undated.length + groups.doneToday.length === 0) {
    return (
      <EmptyState
        heading="Rien à livrer aujourd’hui."
        action={
          <s-stack direction="inline" gap="small-200">
            <s-button href="/app?vue=semaine" variant="primary">
              Voir la semaine
            </s-button>
            <s-button href="/app/commande">Nouvelle commande</s-button>
          </s-stack>
        }
      >
        Les commandes à livrer apparaissent ici, les retards en premier.
      </EmptyState>
    );
  }
  return (
    <>
      {lateCount > 0 ? (
        <s-banner tone="critical" heading={`${lateCount} livraison${lateCount > 1 ? "s" : ""} en retard`}>
          Elles sont en tête de liste.
        </s-banner>
      ) : null}
      <TaskList heading="À livrer aujourd’hui" tasks={groups.due} invoices={invoices} />
      <TaskList heading="Sans date de livraison" tasks={groups.undated} invoices={invoices} />
      <TaskList heading="Déjà livrées" tasks={groups.doneToday} invoices={invoices} />
    </>
  );
}
