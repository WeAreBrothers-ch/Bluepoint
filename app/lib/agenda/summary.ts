import type { IsoDate } from "../metafields/definitions";
import { longDay } from "./dates";
import { deliveryDateText, modeLabel, paymentBadge, type BadgeLabel, type BadgeTone } from "./labels";
import type { ScheduledTask } from "./types";

/**
 * Résumé d'une commande pour le cadre « BluePoint » de la page de commande Shopify :
 * quand, comment, payée ou non, la facture, et la seule chose à faire ensuite.
 * Logique pure : mêmes règles et mêmes mots que l'agenda.
 */

export interface OrderSummary {
  /** Ex. « À livrer demain (jeudi 29 octobre) », « Livrée le mercredi 28 octobre ». */
  readonly headline: string;
  readonly headlineTone: BadgeTone;
  /** « Livraison », « Envoi par la Poste », « Retrait au dépôt ». */
  readonly mode: string;
  readonly payment: BadgeLabel | null;
  readonly invoice: { readonly number: string; readonly viewUrl: string } | null;
  /** La prochaine étape, en une phrase. */
  readonly nextStep: string;
}

const VERB_BY_MODE = { livraison: "À livrer", poste: "À envoyer", retrait: "À préparer pour le retrait" } as const;

function plannedText(task: ScheduledTask, today: IsoDate): string {
  const text = deliveryDateText(task, today);
  return task.mode === null ? text : text.replace(/^À livrer/, VERB_BY_MODE[task.mode]);
}

function headline(task: ScheduledTask, today: IsoDate): { readonly text: string; readonly tone: BadgeTone } {
  switch (task.status) {
    case "livree":
      return { text: task.deliveredOn === null ? "Livrée" : `Livrée le ${longDay(task.deliveredOn)}`, tone: "success" };
    case "expediee":
      return { text: "Partie : en route vers le client", tone: "info" };
    case "partielle":
      return { text: "Livrée en partie", tone: "caution" };
    case "a_livrer":
      if (task.urgency === "sans_date") return { text: "Jour de livraison pas encore choisi", tone: "warning" };
      return { text: plannedText(task, today), tone: task.urgency === "en_retard" ? "critical" : "info" };
  }
}

function isSettled(task: ScheduledTask): boolean {
  return task.financialStatus === "PAID" || task.financialStatus === "REFUNDED" || task.financialStatus === "PARTIALLY_REFUNDED";
}

function nextStep(task: ScheduledTask, invoice: OrderSummary["invoice"]): string {
  const done = modeLabel(task.mode).doneAction;
  if (task.status === "a_livrer" || task.status === "partielle") {
    if (task.urgency === "sans_date") return "Appelez le client pour fixer le jour, puis touchez « Choisir le jour » dans l’agenda.";
    return `Une fois fait, touchez « ${done} » dans l’agenda : la facture se fait toute seule. Inutile d’utiliser « Marquer comme traité » ici.`;
  }
  if (invoice === null) return "La facture n’est pas encore faite : touchez « Faire la facture » dans l’agenda.";
  if (isSettled(task)) return "Tout est fait : livrée et payée.";
  return "Envoyez la facture au client, puis touchez « C’est payé » quand l’argent arrive.";
}

export function orderSummary(task: ScheduledTask, today: IsoDate, invoice: OrderSummary["invoice"]): OrderSummary {
  const title = headline(task, today);
  return {
    headline: title.text,
    headlineTone: title.tone,
    mode: modeLabel(task.mode).label,
    payment: paymentBadge(task),
    invoice,
    nextStep: nextStep(task, invoice),
  };
}

/** Commande annulée ou illisible : rien à faire dans BluePoint. */
export const CANCELLED_SUMMARY: OrderSummary = {
  headline: "Commande annulée : rien à livrer",
  headlineTone: "neutral",
  mode: "—",
  payment: null,
  invoice: null,
  nextStep: "Aucune action n’est nécessaire.",
};
