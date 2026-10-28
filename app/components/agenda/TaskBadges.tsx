import { PAYMENT_LABELS, STATUS_LABELS, modeLabel, urgencyBadge } from "../../lib/agenda/labels";
import type { ScheduledTask } from "../../lib/agenda/types";
import type { IsoDate } from "../../lib/metafields/definitions";

/** Badges d'une tâche : où en est la livraison, Poste ou retrait, client pro, paiement. */

interface TaskBadgesProps {
  readonly task: ScheduledTask;
  readonly today: IsoDate;
  /** Livraison en cours d'enregistrement : on l'affiche déjà comme livrée. */
  readonly optimisticDelivered: boolean;
}

function StatusBadge({ task, today, optimisticDelivered }: TaskBadgesProps) {
  if (optimisticDelivered) return <s-badge tone="success">Livrée — un instant…</s-badge>;
  const badge = task.status === "a_livrer" ? urgencyBadge(task, today) : STATUS_LABELS[task.status];
  return <s-badge tone={badge.tone}>{badge.label}</s-badge>;
}

export function TaskBadges({ task, today, optimisticDelivered }: TaskBadgesProps) {
  const payment = task.financialStatus === null ? null : PAYMENT_LABELS[task.financialStatus];
  return (
    <s-stack direction="inline" gap="small-200">
      <StatusBadge task={task} today={today} optimisticDelivered={optimisticDelivered} />
      {task.mode === "poste" || task.mode === "retrait" ? <s-badge>{modeLabel(task.mode).label}</s-badge> : null}
      {task.isPro ? <s-badge tone="info">Client pro</s-badge> : null}
      {payment === null ? null : <s-badge tone={payment.tone}>{payment.label}</s-badge>}
    </s-stack>
  );
}
