import type { IsoDate } from "../../lib/metafields/definitions";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { GroupTitle } from "../GroupTitle";
import { TaskCard } from "./TaskCard";

/** Liste de tâches sous un titre ; rien n'est affiché si la liste est vide. */

interface TaskListProps {
  readonly heading: string;
  /** Une phrase sous le titre : ce qu'il faut faire de cette liste. */
  readonly hint?: string;
  readonly tasks: readonly ScheduledTask[];
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
  readonly today: IsoDate;
  readonly emailConfigured: boolean;
}

export function TaskList({ heading, hint, tasks, invoices, today, emailConfigured }: TaskListProps) {
  if (tasks.length === 0) return null;
  return (
    <>
      <GroupTitle title={`${heading} (${tasks.length})`} {...(hint === undefined ? {} : { hint })} />
      {tasks.map((task) => (
        <TaskCard key={task.orderId} task={task} invoice={invoices[task.orderId] ?? null} today={today} emailConfigured={emailConfigured} />
      ))}
    </>
  );
}
