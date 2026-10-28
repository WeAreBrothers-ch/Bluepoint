import type { IsoDate } from "../metafields/definitions";
import { daysBetween } from "./dates";
import type { DeliveryTask, ScheduledTask, Urgency } from "./types";

/**
 * Urgence d'une livraison, à l'heure suisse :
 * - en retard : la date limite (ou souhaitée) est dépassée ;
 * - aujourd’hui : prévue aujourd’hui (ou avant, si la limite n'est pas encore dépassée) ;
 * - bientôt : prévue dans 1 ou 2 jours ;
 * - planifiée : plus tard ; sans date : aucune date connue.
 */

export const SOON_THRESHOLD_DAYS = 2;

const URGENCY_RANK: Readonly<Record<Urgency, number>> = {
  en_retard: 0,
  aujourdhui: 1,
  bientot: 2,
  planifiee: 3,
  sans_date: 4,
};

export function urgencyRank(urgency: Urgency): number {
  return URGENCY_RANK[urgency];
}

export function computeUrgency(plannedDate: IsoDate | null, limitDate: IsoDate | null, today: IsoDate): Urgency {
  if (plannedDate === null || limitDate === null) return "sans_date";
  if (daysBetween(today, limitDate) < 0) return "en_retard";
  const daysToPlanned = daysBetween(today, plannedDate);
  if (daysToPlanned <= 0) return "aujourdhui";
  return daysToPlanned <= SOON_THRESHOLD_DAYS ? "bientot" : "planifiee";
}

export function scheduleTask(task: DeliveryTask, today: IsoDate): ScheduledTask {
  const plannedDate = task.requestedDate ?? task.deadline;
  const limitDate = task.deadline ?? task.requestedDate;
  return { ...task, plannedDate, limitDate, urgency: computeUrgency(plannedDate, limitDate, today) };
}

export function isPending(task: DeliveryTask): boolean {
  return task.status !== "livree";
}

/** Ordre d'affichage : à faire avant livrées, puis urgence, date limite, numéro de commande. */
export function compareTasks(a: ScheduledTask, b: ScheduledTask): number {
  const pending = Number(isPending(b)) - Number(isPending(a));
  if (pending !== 0) return pending;
  const urgency = urgencyRank(a.urgency) - urgencyRank(b.urgency);
  if (urgency !== 0) return urgency;
  const limit = (a.limitDate ?? "9999-12-31").localeCompare(b.limitDate ?? "9999-12-31");
  return limit !== 0 ? limit : a.name.localeCompare(b.name, "fr-CH", { numeric: true });
}
