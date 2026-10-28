import { useFetcher } from "react-router";
import type { AgendaActionResult } from "../../lib/agenda/action-result";
import { addressText, directionsUrl, phoneDisplay, phoneHref } from "../../lib/agenda/contact";
import { bottleCountText, deliveryDateText, modeLabel } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { formatChf } from "../../lib/format/money";
import type { IsoDate } from "../../lib/metafields/definitions";
import { gidToNumericId } from "../../lib/shopify/ids";
import { ActionFeedback } from "./ActionFeedback";
import { TaskActions } from "./TaskActions";
import { TaskBadges } from "./TaskBadges";

/**
 * Une livraison, avec tout ce qu'il faut pour la faire sans quitter l'écran :
 * client, jour, adresse et itinéraire, téléphone, vins, montant, remarque, puis l'action.
 */

interface TaskCardProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
  readonly today: IsoDate;
}

function ContactButtons({ task }: { readonly task: ScheduledTask }) {
  const address = addressText(task);
  const directions = directionsUrl(task);
  const call = phoneHref(task.phone);
  if (address === null && task.phone === null) {
    return <s-text color="subdued">Pas d’adresse ni de téléphone sur cette commande.</s-text>;
  }
  return (
    <s-stack direction="block" gap="small-200">
      {address === null ? null : <s-text>{address}</s-text>}
      <s-stack direction="inline" gap="small-200">
        {directions === null ? null : (
          <s-button href={directions} target="_blank" icon="location">
            Itinéraire
          </s-button>
        )}
        {call === null || task.phone === null ? null : (
          <s-button href={call} target="_blank" icon="phone">
            {`Appeler ${phoneDisplay(task.phone)}`}
          </s-button>
        )}
      </s-stack>
    </s-stack>
  );
}

function WineList({ task }: { readonly task: ScheduledTask }) {
  if (task.items.length === 0) return null;
  const bottles = task.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = task.totalCents === null ? "" : ` · ${formatChf(task.totalCents)}`;
  return (
    <s-stack direction="block" gap="small-100">
      {task.items.map((item, index) => (
        <s-text key={`${index}-${item.name}`}>{`${item.quantity} × ${item.name}`}</s-text>
      ))}
      <s-text color="subdued">{`${bottleCountText(bottles)}${total}`}</s-text>
    </s-stack>
  );
}

export function TaskCard({ task, invoice, today }: TaskCardProps) {
  const fetcher = useFetcher<AgendaActionResult>({ key: `agenda-${task.orderId}` });
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const optimisticDelivered = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "livrer";
  const mode = modeLabel(task.mode);
  const late = task.urgency === "en_retard" && task.status !== "livree";

  return (
    <s-box padding="base" border="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type={mode.icon} />
            <s-heading>{task.company ?? task.customerName}</s-heading>
          </s-stack>
          {task.company === null ? null : <s-text>{task.customerName}</s-text>}
          <s-text type="strong" {...(late ? { tone: "critical" as const } : {})}>
            {deliveryDateText(task, today)}
          </s-text>
          <TaskBadges task={task} today={today} optimisticDelivered={optimisticDelivered} />
        </s-stack>
        <ContactButtons task={task} />
        <WineList task={task} />
        {task.note === null ? null : (
          <s-banner tone="info" heading="Remarque pour la livraison">
            {task.note}
          </s-banner>
        )}
        <TaskActions task={task} invoice={invoice} fetcher={fetcher} />
        {result === undefined ? null : <ActionFeedback result={result} />}
        <s-link href={`shopify://admin/orders/${gidToNumericId(task.orderId)}`}>
          {`Tous les détails de la commande ${task.name} (dans Shopify)`}
        </s-link>
      </s-stack>
    </s-box>
  );
}
