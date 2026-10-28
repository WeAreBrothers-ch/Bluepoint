import type { WeekColumn, WeekGroups } from "../../lib/agenda/grouping";
import type { InvoiceRef } from "../../lib/agenda/types";
import type { IsoDate } from "../../lib/metafields/definitions";
import { TaskCard } from "./TaskCard";
import { TaskList } from "./TaskList";

/**
 * Vue « Semaine » : les jours les uns sous les autres, en toutes lettres.
 * Seuls les jours qui ont des livraisons sont affichés, pour ne pas faire défiler pour rien.
 */

interface WeekViewProps {
  readonly groups: WeekGroups;
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
  readonly today: IsoDate;
}

function DaySection({ column, invoices, today }: { readonly column: WeekColumn } & Omit<WeekViewProps, "groups">) {
  const heading = `${column.label}${column.isToday ? " (aujourd’hui)" : ""} — ${column.tasks.length} livraison${column.tasks.length > 1 ? "s" : ""}`;
  return (
    <s-section heading={heading}>
      <s-stack direction="block" gap="base">
        {column.tasks.map((task) => (
          <TaskCard key={task.orderId} task={task} invoice={invoices[task.orderId] ?? null} today={today} />
        ))}
      </s-stack>
    </s-section>
  );
}

export function WeekView({ groups, invoices, today }: WeekViewProps) {
  const busyDays = groups.columns.filter((column) => column.tasks.length > 0);
  return (
    <>
      <TaskList heading="En retard (semaines passées)" tasks={groups.overdueBefore} invoices={invoices} today={today} />
      {busyDays.length === 0 ? (
        <s-section>
          <s-paragraph>Aucune livraison prévue cette semaine-là.</s-paragraph>
        </s-section>
      ) : (
        busyDays.map((column) => <DaySection key={column.date} column={column} invoices={invoices} today={today} />)
      )}
      <TaskList heading="Date de livraison à fixer" tasks={groups.undated} invoices={invoices} today={today} />
    </>
  );
}
