import { useFetcher } from "react-router";
import type { AgendaActionResult } from "../../lib/agenda/action-result";
import { deadlineText, modeLabel, requestedText } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { ActionFeedback } from "./ActionFeedback";
import { OrderDetailModal, useOrderDetail } from "./OrderDetailModal";
import { TaskActions } from "./TaskActions";
import { TaskBadges } from "./TaskBadges";
import { useToastOnce } from "../useToastOnce";

/** Une livraison : mode, client, ville, échéance, badges et actions. */

interface TaskCardProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
}

export function TaskCard({ task, invoice }: TaskCardProps) {
  const fetcher = useFetcher<AgendaActionResult>({ key: `agenda-${task.orderId}` });
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const optimisticDelivered = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "livrer";
  const mode = modeLabel(task.mode);
  const requested = requestedText(task);
  const detail = useOrderDetail(task.orderId);
  const client = task.company === null ? task.customerName : `${task.company} · ${task.customerName}`;

  useToastOnce(result, result?.ok ? result.message : null);

  return (
    <s-box padding="base" border="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="small-300">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type={mode.icon} />
          <s-text type="strong">{mode.label}</s-text>
          <s-link
            commandFor={detail.modalId}
            command="--show"
            onClick={detail.load}
            accessibilityLabel={`Voir le détail de la commande ${task.name}`}
          >
            {task.name}
          </s-link>
        </s-stack>
        <s-text>{task.city === null ? client : `${client} — ${task.city}`}</s-text>
        <s-text color={task.urgency === "en_retard" && task.status !== "livree" ? "base" : "subdued"}>
          {deadlineText(task)}
        </s-text>
        {requested === null ? null : <s-text color="subdued">{requested}</s-text>}
        <TaskBadges task={task} optimisticDelivered={optimisticDelivered} />
        <s-stack direction="inline" gap="small-200">
          <TaskActions task={task} invoice={invoice} fetcher={fetcher} />
          <s-button
            icon="view"
            commandFor={detail.modalId}
            command="--show"
            onClick={detail.load}
            accessibilityLabel={`Voir le détail de la commande ${task.name}`}
          >
            Voir le détail
          </s-button>
        </s-stack>
        {result === undefined ? null : <ActionFeedback result={result} />}
        <OrderDetailModal controls={detail} name={task.name} />
      </s-stack>
    </s-box>
  );
}
