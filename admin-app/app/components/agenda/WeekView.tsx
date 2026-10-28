import type { WeekColumn, WeekGroups } from "../../lib/agenda/grouping";
import type { InvoiceRef } from "../../lib/agenda/types";
import { formatShortSwissDate } from "../../lib/format/dates";
import { TaskCard } from "./TaskCard";
import { TaskList } from "./TaskList";

/**
 * Vue « Semaine » : 7 colonnes du lundi au dimanche sur grand écran,
 * une seule colonne (jours empilés) sur téléphone.
 */

interface WeekViewProps {
  readonly groups: WeekGroups;
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
}

const COLUMNS = "@container (inline-size > 1100px) repeat(7, minmax(0, 1fr)), @container (inline-size > 640px) repeat(2, minmax(0, 1fr)), 1fr";

function DayColumn({ column, invoices }: { readonly column: WeekColumn; readonly invoices: WeekViewProps["invoices"] }) {
  const title = `${column.weekday} ${formatShortSwissDate(column.date)}${column.isToday ? " · aujourd’hui" : ""}`;
  return (
    <s-box padding="small" borderRadius="base" background={column.isToday ? "subdued" : "transparent"}>
      <s-stack direction="block" gap="small">
        <s-heading>{title}</s-heading>
        {column.tasks.length === 0 ? <s-text color="subdued">Rien de prévu</s-text> : null}
        {column.tasks.map((task) => (
          <TaskCard key={task.orderId} task={task} invoice={invoices[task.orderId] ?? null} />
        ))}
      </s-stack>
    </s-box>
  );
}

export function WeekView({ groups, invoices }: WeekViewProps) {
  return (
    <>
      <TaskList heading="En retard, d’avant cette semaine" tasks={groups.overdueBefore} invoices={invoices} />
      <s-section heading="Cette semaine">
        <s-query-container>
          <s-grid gridTemplateColumns={COLUMNS} gap="base">
            {groups.columns.map((column) => (
              <DayColumn key={column.date} column={column} invoices={invoices} />
            ))}
          </s-grid>
        </s-query-container>
      </s-section>
      <TaskList heading="Sans date de livraison" tasks={groups.undated} invoices={invoices} />
    </>
  );
}
