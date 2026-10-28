import type { TodayGroups } from "../../lib/agenda/grouping";
import type { InvoiceRef } from "../../lib/agenda/types";
import type { IsoDate } from "../../lib/metafields/definitions";
import { EmptyState } from "../EmptyState";
import { TaskList } from "./TaskList";

/** Vue « Aujourd’hui » : retards, livraisons du jour, celles de demain, sans date, déjà livrées. */

interface TodayViewProps {
  readonly groups: TodayGroups;
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
  readonly today: IsoDate;
  readonly emailConfigured: boolean;
}

export function TodayView({ groups, invoices, today, emailConfigured }: TodayViewProps) {
  const toDeliver = groups.late.length + groups.today.length;
  const total = toDeliver + groups.tomorrow.length + groups.undated.length + groups.doneToday.length;
  if (total === 0) {
    return (
      <EmptyState
        heading="Rien à livrer aujourd’hui ni demain."
        action={
          <s-stack direction="inline" gap="small-200">
            <s-button href="/app?vue=semaine" variant="primary">
              Voir la semaine
            </s-button>
            <s-button href="/app/commande">Prendre une commande</s-button>
          </s-stack>
        }
      >
        Les commandes à livrer apparaîtront ici dès qu’elles ont une date de livraison.
      </EmptyState>
    );
  }
  const list = { invoices, today, emailConfigured };
  return (
    <>
      {groups.late.length > 0 ? (
        <s-banner tone="critical" heading={`${groups.late.length} livraison${groups.late.length > 1 ? "s" : ""} en retard`}>
          {"À livrer en priorité\u202F: elles sont juste en dessous."}
        </s-banner>
      ) : null}
      {toDeliver === 0 && groups.doneToday.length === 0 ? (
        <s-banner tone="success" heading="Rien à livrer aujourd’hui." />
      ) : null}
      <TaskList heading="En retard" tasks={groups.late} {...list} />
      <TaskList heading="À livrer aujourd’hui" tasks={groups.today} {...list} />
      <TaskList heading="Demain" tasks={groups.tomorrow} {...list} />
      <TaskList heading="Date de livraison à fixer" tasks={groups.undated} {...list} />
      <TaskList heading="Déjà livrées aujourd’hui" tasks={groups.doneToday} {...list} />
    </>
  );
}
