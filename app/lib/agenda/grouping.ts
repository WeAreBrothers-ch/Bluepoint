import type { IsoDate } from "../metafields/definitions";
import { daysOfWeek, shortWeekday } from "./dates";
import { compareTasks, isPending, scheduleTask } from "./urgency";
import type { DateRange, DeliveryTask, ScheduledTask } from "./types";

/** Regroupe les tâches pour les deux vues de l'agenda. */

export interface TodayGroups {
  /** À livrer aujourd'hui, avec les retards en tête (signalés par leur urgence). */
  readonly due: readonly ScheduledTask[];
  /** À livrer, sans aucune date connue. */
  readonly undated: readonly ScheduledTask[];
  /** Déjà livrées, prévues aujourd'hui. */
  readonly doneToday: readonly ScheduledTask[];
}

export interface WeekColumn {
  readonly date: IsoDate;
  /** Ex. « lun. ». */
  readonly weekday: string;
  readonly isToday: boolean;
  readonly isPast: boolean;
  readonly tasks: readonly ScheduledTask[];
}

export interface WeekGroups {
  readonly columns: readonly WeekColumn[];
  /** Retards antérieurs à la semaine affichée (restent visibles). */
  readonly overdueBefore: readonly ScheduledTask[];
  readonly undated: readonly ScheduledTask[];
}

function sorted(tasks: readonly ScheduledTask[]): ScheduledTask[] {
  return [...tasks].sort(compareTasks);
}

export function scheduleAll(tasks: readonly DeliveryTask[], today: IsoDate): ScheduledTask[] {
  return tasks.map((task) => scheduleTask(task, today));
}

export function groupToday(tasks: readonly DeliveryTask[], today: IsoDate): TodayGroups {
  const scheduled = scheduleAll(tasks, today);
  const pending = scheduled.filter(isPending);
  return {
    due: sorted(pending.filter((task) => task.urgency === "en_retard" || task.urgency === "aujourdhui")),
    undated: sorted(pending.filter((task) => task.urgency === "sans_date")),
    doneToday: sorted(scheduled.filter((task) => !isPending(task) && task.plannedDate === today)),
  };
}

export function groupWeek(tasks: readonly DeliveryTask[], week: DateRange, today: IsoDate): WeekGroups {
  const scheduled = scheduleAll(tasks, today);
  const columns = daysOfWeek(week).map(
    (date): WeekColumn => ({
      date,
      weekday: shortWeekday(date),
      isToday: date === today,
      isPast: date < today,
      tasks: sorted(scheduled.filter((task) => task.plannedDate === date)),
    }),
  );
  const pending = scheduled.filter(isPending);
  return {
    columns,
    overdueBefore: sorted(pending.filter((task) => task.plannedDate !== null && task.plannedDate < week.start)),
    undated: sorted(pending.filter((task) => task.urgency === "sans_date")),
  };
}
