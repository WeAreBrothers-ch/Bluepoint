import { PAYMENT_LABELS, STATUS_LABELS, URGENCY_LABELS } from "../../lib/agenda/labels";
import type { ScheduledTask } from "../../lib/agenda/types";

/** Badges d'une tâche : urgence (ou état de livraison), client pro, paiement. */

interface TaskBadgesProps {
  readonly task: ScheduledTask;
  /** Livraison en cours d'enregistrement : on l'affiche déjà comme livrée. */
  readonly optimisticDelivered: boolean;
}

function StatusBadge({ task, optimisticDelivered }: TaskBadgesProps) {
  if (optimisticDelivered) return <s-badge tone="success">Livrée (enregistrement…)</s-badge>;
  if (task.status === "a_livrer") {
    const urgency = URGENCY_LABELS[task.urgency];
    return <s-badge tone={urgency.tone}>{urgency.label}</s-badge>;
  }
  const status = STATUS_LABELS[task.status];
  return <s-badge tone={status.tone}>{status.label}</s-badge>;
}

export function TaskBadges({ task, optimisticDelivered }: TaskBadgesProps) {
  const payment = task.financialStatus === null ? null : PAYMENT_LABELS[task.financialStatus];
  return (
    <s-stack direction="inline" gap="small-200">
      <StatusBadge task={task} optimisticDelivered={optimisticDelivered} />
      {task.isPro ? <s-badge tone="info">Pro</s-badge> : null}
      {payment === null ? null : <s-badge tone={payment.tone}>{payment.label}</s-badge>}
    </s-stack>
  );
}
