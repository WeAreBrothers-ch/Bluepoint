import type { DeliveryMode, IsoDate } from "../metafields/definitions";
import { addDays, longDay } from "./dates";
import type { DeliveryStatus, DeliveryTask, FinancialStatus, ScheduledTask } from "./types";

/**
 * Libellés de l'agenda, écrits pour une personne qui n'est pas à l'aise avec l'informatique :
 * mots de tous les jours, jours en toutes lettres, aucun terme de Shopify.
 */

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
  /** Bouton qui confirme la remise au client, en phrase entière : « J'ai livré la commande ». */
  readonly doneAction: string;
  /** Question de confirmation, ex. « La commande #1042 est-elle bien livrée ? ». */
  readonly doneQuestion: (orderName: string) => string;
  /** Bouton d'une commande sans date : « Choisir le jour de livraison ». */
  readonly chooseDay: string;
  /** Question du choix du jour, ex. « Quel jour livrer la commande #1042 ? ». */
  readonly dayQuestion: (orderName: string) => string;
}

export const MODE_LABELS: Readonly<Record<DeliveryMode, ModeLabel>> = {
  livraison: {
    label: "Livraison",
    icon: "delivery",
    doneAction: "J’ai livré la commande",
    doneQuestion: (name) => `Avez-vous bien livré la commande ${name}\u202F?`,
    chooseDay: "Choisir le jour de livraison",
    dayQuestion: (name) => `Quel jour livrer la commande ${name}\u202F?`,
  },
  poste: {
    label: "Envoi par la Poste",
    icon: "package",
    doneAction: "J’ai envoyé le colis",
    doneQuestion: (name) => `Avez-vous bien posté le colis de la commande ${name}\u202F?`,
    chooseDay: "Choisir le jour d’envoi",
    dayQuestion: (name) => `Quel jour envoyer la commande ${name}\u202F?`,
  },
  retrait: {
    label: "Retrait au dépôt",
    icon: "store",
    doneAction: "Le client est venu la chercher",
    doneQuestion: (name) => `Le client est-il bien venu chercher la commande ${name}\u202F?`,
    chooseDay: "Choisir le jour de retrait",
    dayQuestion: (name) => `Quel jour le client vient-il chercher la commande ${name}\u202F?`,
  },
};

const UNKNOWN_MODE: ModeLabel = { ...MODE_LABELS.livraison, label: "Livraison (mode à vérifier)", icon: "question-circle" };

export function modeLabel(mode: DeliveryMode | null): ModeLabel {
  return mode === null ? UNKNOWN_MODE : MODE_LABELS[mode];
}

export const STATUS_LABELS: Readonly<Record<Exclude<DeliveryStatus, "a_livrer">, BadgeLabel>> = {
  partielle: { label: "Livrée en partie", tone: "caution" },
  expediee: { label: "En route vers le client", tone: "info" },
  livree: { label: "Déjà livrée", tone: "success" },
};

export const PAYMENT_LABELS: Readonly<Record<FinancialStatus, BadgeLabel>> = {
  PENDING: { label: "Le client n’a pas encore payé", tone: "warning" },
  PAID: { label: "Le client a déjà payé", tone: "success" },
  PARTIALLY_PAID: { label: "Le client a payé une partie", tone: "caution" },
  AUTHORIZED: { label: "Paiement par carte à confirmer", tone: "info" },
  PARTIALLY_REFUNDED: { label: "Remboursée en partie", tone: "neutral" },
  REFUNDED: { label: "Remboursée", tone: "neutral" },
  VOIDED: { label: "Paiement annulé", tone: "neutral" },
  EXPIRED: { label: "Paiement par carte échoué", tone: "critical" },
};

/**
 * Badge de paiement. Une commande pas encore payée avec des conditions dit pourquoi :
 * « Le client paiera sur facture (30 jours) » (bon de commande d'un pro), « Le client paiera à la livraison » (sur place).
 */
export function paymentBadge(task: Pick<DeliveryTask, "financialStatus" | "paymentTerms">): BadgeLabel | null {
  if (task.financialStatus === null) return null;
  const terms = task.paymentTerms;
  if (task.financialStatus === "PENDING" && terms !== null) {
    if (terms.type === "NET" && terms.dueInDays !== null) return { label: `Le client paiera sur facture (${terms.dueInDays} jours)`, tone: "info" };
    if (terms.type === "FULFILLMENT" || terms.type === "RECEIPT") return { label: "Le client paiera à la livraison", tone: "warning" };
  }
  return PAYMENT_LABELS[task.financialStatus];
}

/** Badge de la tâche encore à livrer : « En retard », « Aujourd’hui », « Demain »… */
export function urgencyBadge(task: ScheduledTask, today: IsoDate): BadgeLabel {
  switch (task.urgency) {
    case "en_retard":
      return { label: "En retard", tone: "critical" };
    case "aujourdhui":
      return { label: "Aujourd’hui", tone: "warning" };
    case "sans_date":
      return { label: "Jour à choisir", tone: "neutral" };
    default:
      return task.plannedDate === addDays(today, 1)
        ? { label: "Demain", tone: "caution" }
        : { label: "Prévue", tone: "info" };
  }
}

/** Ex. « demain (jeudi 29 octobre) », « aujourd’hui », « le samedi 31 octobre ». */
function dayText(date: IsoDate, today: IsoDate): string {
  if (date === today) return "aujourd’hui";
  if (date === addDays(today, 1)) return `demain (${longDay(date)})`;
  return `le ${longDay(date)}`;
}

/** Phrase de la date de livraison, ex. « À livrer demain (jeudi 29 octobre) ». */
export function deliveryDateText(task: ScheduledTask, today: IsoDate): string {
  const { plannedDate, limitDate } = task;
  if (plannedDate === null || limitDate === null) return "Jour de livraison à choisir avec le client";
  if (task.status === "livree") return `Prévue ${dayText(plannedDate, today)}`;
  if (task.urgency === "en_retard") return `Devait être livrée au plus tard ${dayText(limitDate, today)}`;
  // « aujourd’hui » couvre aussi une date souhaitée passée dont la limite n'est pas encore atteinte.
  const dueToday = task.urgency === "aujourdhui";
  const when = dueToday ? "aujourd’hui" : dayText(plannedDate, today);
  const sameLimit = limitDate === plannedDate || (dueToday && limitDate === today);
  return `À livrer ${when}${sameLimit ? "" : ` (au plus tard ${dayText(limitDate, today)})`}`;
}

/**
 * Ligne de date d'une carte, seulement quand elle apprend quelque chose : le titre de la partie
 * (« À livrer aujourd’hui », « Demain », « Jeudi 29 octobre ») dit déjà quand livrer.
 * Restent le retard et une date limite plus tardive que le jour prévu.
 */
export function cardDateLine(task: ScheduledTask, today: IsoDate): string | null {
  const { plannedDate, limitDate } = task;
  if (task.status === "livree" || plannedDate === null || limitDate === null) return null;
  if (task.urgency === "en_retard") return deliveryDateText(task, today);
  const sameLimit = limitDate === plannedDate || (task.urgency === "aujourdhui" && limitDate === today);
  return sameLimit ? null : `Au plus tard ${dayText(limitDate, today)}`;
}

/** Ex. « 8 bouteilles ». */
export function bottleCountText(count: number): string {
  return `${count} bouteille${count > 1 ? "s" : ""}`;
}
