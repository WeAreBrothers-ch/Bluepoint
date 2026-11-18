import { STATUS_LABELS, modeLabel, paymentBadge } from "../../lib/agenda/labels";
import type { ScheduledTask } from "../../lib/agenda/types";

/**
 * Badges d'une tâche, réduits à ce qui sert : retard ou état de la livraison, Poste ou retrait, paiement.
 * Le jour n'y est pas : le titre de la partie le dit déjà.
 */

interface TaskBadgesProps {
  readonly task: ScheduledTask;
  /** Livraison en cours d'enregistrement : on l'affiche déjà comme livrée. */
  readonly optimisticDelivered: boolean;
}

/** Où en est la livraison : en retard, en route, déjà livrée. Rien quand tout est normal. */
export function StatusBadge({ task, optimisticDelivered }: TaskBadgesProps) {
  if (optimisticDelivered) return <s-badge tone="success">Déjà livrée — un instant…</s-badge>;
  if (task.status === "a_livrer") {
    return task.urgency === "en_retard" ? <s-badge tone="critical">En retard</s-badge> : null;
  }
  const badge = STATUS_LABELS[task.status];
  return <s-badge tone={badge.tone}>{badge.label}</s-badge>;
}

export function TaskBadges({ task, optimisticDelivered }: TaskBadgesProps) {
  const payment = paymentBadge(task);
  return (
    <s-stack direction="inline" gap="small-200">
      <StatusBadge task={task} optimisticDelivered={optimisticDelivered} />
      {task.mode === "poste" || task.mode === "retrait" ? <s-badge>{modeLabel(task.mode).label}</s-badge> : null}
      {payment === null ? null : <s-badge tone={payment.tone}>{payment.label}</s-badge>}
    </s-stack>
  );
}

/**
 * Si le client a payé : ce qui change ce qu'on fait à la livraison. Poste ou retrait est déjà écrit dans le bandeau
 * de la carte (« Particulier · Envoi par la Poste ») : pas de second badge qui répète la même chose sur un petit écran.
 */
export function PaymentBadges({ task }: { readonly task: TaskBadgesProps["task"] }) {
  const payment = paymentBadge(task);
  return payment === null ? null : <s-badge tone={payment.tone}>{payment.label}</s-badge>;
}
