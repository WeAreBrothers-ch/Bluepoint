import { orderHref } from "../../lib/navigation";
import { useState } from "react";
import { useFetcher } from "react-router";
import type { AgendaActionResult } from "../../lib/agenda/action-result";
import { addressText, directionsUrl, phoneDisplay, phoneHref } from "../../lib/agenda/contact";
import { bottleCountText, cardDateLine, modeLabel, paymentBadge } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { formatChf } from "../../lib/format/money";
import type { IsoDate } from "../../lib/metafields/definitions";
import { gidToNumericId } from "../../lib/shopify";
import { ClientCard } from "../ClientCard";
import { FILL } from "../fill";
import { ClientKindBadge, clientKind } from "../ClientKindBadge";
import { IconHeading } from "../IconHeading";
import { ActionFeedback } from "./ActionFeedback";
import { TaskActions } from "./TaskActions";
import { PaymentBadges, StatusBadge } from "./TaskBadges";

/**
 * Carte d'une livraison (Livraisons, aujourd'hui et semaine). Le jour n'est répété que s'il apprend
 * quelque chose (retard, date limite) : le titre de la partie le dit déjà.
 */

interface TaskCardProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
  readonly today: IsoDate;
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
      <s-button key="call" href={call} target="_blank" icon="phone" accessibilityLabel={`Appeler le ${phoneDisplay(task.phone)}`}>
        {phoneDisplay(task.phone)}
      </s-button>
    ),
  ].filter((button) => button !== null);
  // L'adresse seule ; le numéro est écrit dans le bouton « Appeler » (un toucher le compose).
  return (
    <s-stack direction="block" gap="small-200">
      {address === null ? null : <s-text>{address}</s-text>}
      {buttons.length === 0 ? null : (
        <s-stack direction="inline" gap="small-200">
          {buttons}
        </s-stack>
      )}
    </s-stack>
  );
}

/** Ce qu'il y a à livrer, vin par vin (pour charger le camion). */
function WineList({ task }: { readonly task: ScheduledTask }) {
  if (task.items.length === 0) return null;
  return (
    <s-stack direction="block" gap="small-100">
      {task.items.map((item, index) => (
        <s-text key={`${index}-${item.name}`}>{`${item.quantity} × ${item.name}`}</s-text>
      ))}
    </s-stack>
  );
}

/** En une ligne : où, combien de bouteilles, combien d'argent. Ex. « Cully · 18 bouteilles · CHF 648.00 ». */
function summaryLine(task: ScheduledTask): string {
  const bottles = task.items.reduce((sum, item) => sum + item.quantity, 0);
  return [
    task.mode === "retrait" ? null : task.city,
    task.items.length === 0 ? null : bottleCountText(bottles),
    task.totalCents === null ? null : formatChf(task.totalCents),
  ]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
}

/**
 * Une livraison, en court : qui, où, combien, si c'est payé, la remarque, puis LE bouton à toucher.
 * « Détails » ouvre sur place le reste (personne à demander, date limite, adresse, itinéraire, téléphone,
 * vins, changer le jour, voir la commande) : rien n'est perdu, mais la liste reste courte sur un téléphone.
 */
export function TaskCard({ task, invoice, today }: TaskCardProps) {
  const fetcher = useFetcher<AgendaActionResult>({ key: `agenda-${task.orderId}` });
  const [open, setOpen] = useState(false);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const optimisticDelivered = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "livrer";
  const mode = modeLabel(task.mode);
  const late = task.urgency === "en_retard" && task.status !== "livree";
  const delivered = task.status === "livree";
  const dateLine = cardDateLine(task, today);
  const who = task.company === null ? null : task.customerName;
  const summary = summaryLine(task);

  return (
    <ClientCard
      kind={clientKind(task.isPro)}
      header={
        <>
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
            <IconHeading icon={mode.icon}>{task.company ?? task.customerName}</IconHeading>
            <StatusBadge task={task} optimisticDelivered={optimisticDelivered} />
          </s-grid>
          <s-stack direction="inline">
            <ClientKindBadge isPro={task.isPro} detail={mode.label} />
          </s-stack>
        </>
      }
    >
      <s-stack direction="block" gap="small-200">
        {summary === "" ? null : <s-text type="strong">{summary}</s-text>}
        {paymentBadge(task) === null ? null : (
          <s-stack direction="inline">
            <PaymentBadges task={task} />
          </s-stack>
        )}
      </s-stack>
      {/* Une fois livrée, la remarque pour la livraison ne sert plus. */}
      {task.note === null || delivered ? null : <s-banner tone="info">{`Remarque : ${task.note}`}</s-banner>}
      {task.cardDiscountToCheck ? (
        <s-banner tone="warning" heading="Rabais de 2 % pas dû">
          Le client a pris le rabais « paiement par carte » sans payer par carte. Appelez-le pour le lui expliquer.
        </s-banner>
      ) : null}
      {open ? (
        <s-box padding="small-300" background="subdued" borderRadius="base">
          <s-stack direction="block" gap="small-300">
            {who === null ? null : <s-text>{`Personne à demander\u202F: ${who}`}</s-text>}
            {dateLine === null ? null : (
              <s-text type="strong" {...(late ? { tone: "critical" as const } : {})}>
                {dateLine}
              </s-text>
            )}
            {/* Une fois livrée, l'adresse et l'itinéraire ne servent plus. */}
            {delivered ? null : <ContactButtons task={task} />}
            {delivered ? null : <WineList task={task} />}
          </s-stack>
        </s-box>
      ) : null}
      <TaskActions
        task={task}
        invoice={invoice}
        fetcher={fetcher}
        today={today}
        showLinks={open}
        viewOrderHref={orderHref(gidToNumericId(task.orderId), "livraisons")}
      />
      {result === undefined ? null : <ActionFeedback result={result} />}
      <s-grid gridTemplateColumns="minmax(0, 1fr)">
        <s-button {...FILL} variant="tertiary" icon={open ? "chevron-up" : "chevron-down"} onClick={() => setOpen((value) => !value)}>
          {open ? "Moins de détails" : delivered ? "Détails" : "Détails : adresse, téléphone, vins"}
        </s-button>
      </s-grid>
    </ClientCard>
  );
}
