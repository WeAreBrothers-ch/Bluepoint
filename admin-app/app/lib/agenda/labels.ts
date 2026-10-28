import { formatSwissDate } from "../format/dates";
import { withColon } from "../format/typography";
import type { DeliveryMode } from "../metafields/definitions";
import type { DeliveryStatus, FinancialStatus, ScheduledTask, Urgency } from "./types";

/** Libellés et tons des badges de l'agenda (français, typographie suisse). */

export type BadgeTone = "neutral" | "info" | "success" | "caution" | "warning" | "critical";

export interface BadgeLabel {
  readonly label: string;
  readonly tone: BadgeTone;
}

/** Icônes Polaris utilisées pour les modes de livraison. */
export type ModeIcon = "delivery" | "package" | "store" | "question-circle";

export interface ModeLabel {
  readonly label: string;
  readonly icon: ModeIcon;
}

export const MODE_LABELS: Readonly<Record<DeliveryMode, ModeLabel>> = {
  livraison: { label: "Livraison", icon: "delivery" },
  poste: { label: "Poste", icon: "package" },
  retrait: { label: "Retrait", icon: "store" },
};

export function modeLabel(mode: DeliveryMode | null): ModeLabel {
  return mode === null ? { label: "Mode à préciser", icon: "question-circle" } : MODE_LABELS[mode];
}

export const URGENCY_LABELS: Readonly<Record<Urgency, BadgeLabel>> = {
  en_retard: { label: "En retard", tone: "critical" },
  aujourdhui: { label: "Aujourd’hui", tone: "warning" },
  bientot: { label: "Bientôt", tone: "caution" },
  planifiee: { label: "Planifiée", tone: "info" },
  sans_date: { label: "Sans date", tone: "neutral" },
};

export const STATUS_LABELS: Readonly<Record<Exclude<DeliveryStatus, "a_livrer">, BadgeLabel>> = {
  partielle: { label: "Partiellement expédiée", tone: "caution" },
  expediee: { label: "Expédiée", tone: "info" },
  livree: { label: "Livrée", tone: "success" },
};

export const PAYMENT_LABELS: Readonly<Record<FinancialStatus, BadgeLabel>> = {
  PENDING: { label: "Bon de commande — non payé", tone: "warning" },
  PAID: { label: "Payée", tone: "success" },
  PARTIALLY_PAID: { label: "Partiellement payée", tone: "caution" },
  AUTHORIZED: { label: "Paiement autorisé", tone: "info" },
  PARTIALLY_REFUNDED: { label: "Partiellement remboursée", tone: "neutral" },
  REFUNDED: { label: "Remboursée", tone: "neutral" },
  VOIDED: { label: "Paiement annulé", tone: "neutral" },
  EXPIRED: { label: "Paiement expiré", tone: "critical" },
};

/** Ligne d'échéance d'une tâche, ex. « Au plus tard : 21.10.2026 ». */
export function deadlineText(task: ScheduledTask): string {
  const origin = task.dateSource === "attribut" ? " (indiquée au panier)" : "";
  if (task.deadline !== null) return `${withColon("Au plus tard")} ${formatSwissDate(task.deadline)}${origin}`;
  if (task.requestedDate !== null) return `${withColon("Souhaitée le")} ${formatSwissDate(task.requestedDate)}${origin}`;
  return "Aucune date de livraison";
}

/** Date souhaitée affichée en plus quand elle diffère de la date limite. */
export function requestedText(task: ScheduledTask): string | null {
  if (task.requestedDate === null || task.deadline === null || task.requestedDate === task.deadline) return null;
  return `${withColon("Souhaitée le")} ${formatSwissDate(task.requestedDate)}`;
}
