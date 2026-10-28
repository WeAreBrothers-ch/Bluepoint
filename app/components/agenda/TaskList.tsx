import type { IsoDate } from "../../lib/metafields/definitions";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { TaskCard } from "./TaskCard";

/** Liste de tâches sous un titre ; rien n'est affiché si la liste est vide. */

interface TaskListProps {
  readonly heading: string;
  readonly tasks: readonly ScheduledTask[];
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
  readonly today: IsoDate;
}

export function TaskList({ heading, tasks, invoices, today }: TaskListProps) {
  if (tasks.length === 0) return null;
  return (
    <s-section heading={`${heading} (${tasks.length})`}>
      <s-stack direction="block" gap="base">
        {tasks.map((task) => (
          <TaskCard key={task.orderId} task={task} invoice={invoices[task.orderId] ?? null} today={today} />
        ))}
      </s-stack>
    </s-section>
  );
}
