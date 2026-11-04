import { useFetcher } from "react-router";
import type { AgendaActionResult } from "../../lib/agenda/action-result";
import { addressText, directionsUrl, phoneDisplay, phoneHref } from "../../lib/agenda/contact";
import { bottleCountText, cardDateLine, modeLabel } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { formatChf } from "../../lib/format/money";
import type { IsoDate } from "../../lib/metafields/definitions";
import { gidToNumericId } from "../../lib/shopify";
import { ClientCard } from "../ClientCard";
import { ActionFeedback } from "./ActionFeedback";
import { TaskActions } from "./TaskActions";
import { PaymentBadges, StatusBadge } from "./TaskBadges";

/**
 * Une livraison, dans l'ordre où on en a besoin : qui, où (itinéraire, téléphone), quels vins,
 * combien, la remarque, puis l'action. Le jour n'est répété que s'il apprend quelque chose
 * (retard, date limite) : le titre de la partie le dit déjà.
 */

interface TaskCardProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
  readonly today: IsoDate;
  readonly emailConfigured: boolean;
}

export function ContactButtons({ task }: { readonly task: ScheduledTask }) {
  // Retrait : le client vient au dépôt, son adresse et l'itinéraire ne servent à rien.
  const pickup = task.mode === "retrait";
  const address = pickup ? null : addressText(task);
  // Poste : le colis part, on n'y va pas. On garde l'adresse et le téléphone, sans itinéraire.
  const directions = pickup || task.mode === "poste" ? null : directionsUrl(task);
  const call = phoneHref(task.phone);
  if (address === null && task.phone === null) {
    return pickup ? null : <s-text color="subdued">Pas d’adresse ni de téléphone sur cette commande.</s-text>;
  }
  const buttons = [
    directions === null ? null : (
      <s-button key="route" href={directions} target="_blank" icon="location">
        Itinéraire
      </s-button>
    ),
    call === null || task.phone === null ? null : (
      <s-button key="call" href={call} target="_blank" icon="phone" accessibilityLabel={`Appeler ${phoneDisplay(task.phone)}`}>
        Appeler
      </s-button>
    ),
  ].filter((button) => button !== null);
  // Une seule ligne : l'adresse, puis le numéro (le bouton « Appeler » le compose).
  const line = [address, task.phone === null ? null : phoneDisplay(task.phone)].filter((part) => part !== null).join(" · ");
  return (
    <s-stack direction="block" gap="small-200">
      <s-text>{line}</s-text>
      {buttons.length === 0 ? null : (
        <s-stack direction="inline" gap="small-200">
          {buttons}
        </s-stack>
      )}
    </s-stack>
  );
}

/** Ce qu'il y a à livrer. Une fois livrée, seul le total compte : la liste des vins ne sert plus. */
function WineList({ task }: { readonly task: ScheduledTask }) {
  if (task.items.length === 0) return <PaymentBadges task={task} />;
  const done = task.status === "livree";
  const bottles = task.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = task.totalCents === null ? "" : ` · ${formatChf(task.totalCents)}`;
  return (
    <s-stack direction="block" gap="small-200">
      {done ? null : <s-divider />}
      {done
        ? null
        : task.items.map((item, index) => <s-text key={`${index}-${item.name}`}>{`${item.quantity} × ${item.name}`}</s-text>)}
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text type="strong">{`${bottleCountText(bottles)}${total}`}</s-text>
        <PaymentBadges task={task} />
      </s-stack>
    </s-stack>
  );
}

export function TaskCard({ task, invoice, today, emailConfigured }: TaskCardProps) {
  const fetcher = useFetcher<AgendaActionResult>({ key: `agenda-${task.orderId}` });
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const optimisticDelivered = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "livrer";
  const mode = modeLabel(task.mode);
  const late = task.urgency === "en_retard" && task.status !== "livree";
  const dateLine = cardDateLine(task, today);
  const who = task.company === null ? `Commande ${task.name}` : `${task.customerName} · commande ${task.name}`;

  return (
    <ClientCard
      header={
        <>
          <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-icon type={mode.icon} />
              <s-heading>{task.company ?? task.customerName}</s-heading>
            </s-stack>
            <StatusBadge task={task} optimisticDelivered={optimisticDelivered} />
          </s-stack>
          <s-text color="subdued">{who}</s-text>
          {dateLine === null ? null : (
            <s-text type="strong" {...(late ? { tone: "critical" as const } : {})}>
              {dateLine}
            </s-text>
          )}
        </>
      }
    >
        {/* Une fois livrée, l'adresse et l'itinéraire ne servent plus. */}
        {task.status === "livree" ? null : <ContactButtons task={task} />}
        <WineList task={task} />
        {/* Une fois livrée, la remarque pour la livraison ne sert plus. */}
        {task.note === null || task.status === "livree" ? null : <s-banner tone="info">{`Remarque : ${task.note}`}</s-banner>}
        {task.cardDiscountToCheck ? (
          <s-banner tone="warning" heading="Rabais carte à vérifier">
            Ce client a utilisé le code CARTE2 (2 % si l’on paie par carte tout de suite), mais la commande n’est pas payée par carte. Le rabais
            n’est pas dû : appelez le client pour le lui expliquer.
          </s-banner>
        ) : null}
        <TaskActions
          task={task}
          invoice={invoice}
          fetcher={fetcher}
          emailConfigured={emailConfigured}
          today={today}
          viewOrderHref={`/app/commandes/${gidToNumericId(task.orderId)}`}
        />
        {result === undefined ? null : <ActionFeedback result={result} />}
    </ClientCard>
  );
}
