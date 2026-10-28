import type { IsoDate } from "../metafields/definitions";
import { addDays, capitalize, daysOfWeek, longDay } from "./dates";
import { compareTasks, isPending, scheduleTask } from "./urgency";
import type { DateRange, DeliveryTask, ScheduledTask } from "./types";

/** Regroupe les tâches pour les deux vues de l'agenda. */

export interface TodayGroups {
  /** Date limite dépassée : affichées en premier, à part. */
  readonly late: readonly ScheduledTask[];
  /** À livrer aujourd'hui. */
  readonly today: readonly ScheduledTask[];
  /** À livrer demain : pour préparer la tournée la veille. */
  readonly tomorrow: readonly ScheduledTask[];
  /** À livrer, sans aucune date connue. */
  readonly undated: readonly ScheduledTask[];
  /** Livrées aujourd'hui (même en avance), ou prévues aujourd'hui et déjà livrées. */
  readonly doneToday: readonly ScheduledTask[];
}

export interface WeekColumn {
  readonly date: IsoDate;
  /** Ex. « Lundi 26 octobre ». */
  readonly label: string;
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
  const tomorrow = addDays(today, 1);
  return {
    late: sorted(pending.filter((task) => task.urgency === "en_retard")),
    today: sorted(pending.filter((task) => task.urgency === "aujourdhui")),
    tomorrow: sorted(pending.filter((task) => task.urgency !== "en_retard" && task.plannedDate === tomorrow)),
    undated: sorted(pending.filter((task) => task.urgency === "sans_date")),
    doneToday: sorted(
      scheduled.filter((task) => !isPending(task) && (task.deliveredOn === today || task.plannedDate === today)),
    ),
  };
}

export function groupWeek(tasks: readonly DeliveryTask[], week: DateRange, today: IsoDate): WeekGroups {
  const scheduled = scheduleAll(tasks, today);
  const columns = daysOfWeek(week).map(
    (date): WeekColumn => ({
      date,
      label: capitalize(longDay(date)),
      isToday: date === today,
      isPast: date < today,
      tasks: sorted(scheduled.filter((task) => task.plannedDate === date)),
    }),
  );
  const pending = scheduled.filter(isPending);
  return {
    columns,
    overdueBefore: sorted(
      pending.filter((task) => task.plannedDate !== null && task.plannedDate < week.start && task.urgency === "en_retard"),
    ),
    undated: sorted(pending.filter((task) => task.urgency === "sans_date")),
  };
}
