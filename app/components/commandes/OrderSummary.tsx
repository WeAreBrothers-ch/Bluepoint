import { useFetcher } from "react-router";
import type { AgendaActionResult } from "../../lib/agenda/action-result";
import { modeLabel } from "../../lib/agenda/labels";
import type { InvoiceRef } from "../../lib/agenda/types";
import type { OrderDetail } from "../../lib/commandes/detail";
import type { IsoDate } from "../../lib/metafields/definitions";
import { ActionFeedback } from "../agenda/ActionFeedback";
import { TaskActions } from "../agenda/TaskActions";
import { TaskBadges } from "../agenda/TaskBadges";

/**
 * Haut de la fiche commande : pour qui, quand, la remarque, puis les mêmes boutons que la carte
 * de l'agenda (C'est livré, Changer le jour, la facture et son envoi).
 */

interface OrderSummaryProps {
  readonly detail: OrderDetail;
  readonly invoice: InvoiceRef | null;
  readonly today: IsoDate;
  readonly emailConfigured: boolean;
}

export function OrderSummary({ detail, invoice, today, emailConfigured }: OrderSummaryProps) {
  const { task } = detail;
  // Même clé que la carte de l'agenda : l'action en cours se voit des deux côtés.
  const fetcher = useFetcher<AgendaActionResult>({ key: `agenda-${task.orderId}` });
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const optimisticDelivered = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "livrer";
  // Avant « C'est livré » seulement : ensuite, la facture (ou « Faire la facture ») est affichée.
  const beforeDelivery = task.status !== "livree" && task.status !== "expediee" && !optimisticDelivered;
  const mode = modeLabel(task.mode);

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type={mode.icon} />
            <s-heading>{task.company ?? task.customerName}</s-heading>
          </s-stack>
          <s-text type="strong" {...(detail.late ? { tone: "critical" as const } : {})}>
            {detail.headline}
          </s-text>
          <TaskBadges task={task} optimisticDelivered={optimisticDelivered} />
        </s-stack>
        {/* Une fois livrée, la remarque pour la livraison ne sert plus. */}
        {task.note === null || !beforeDelivery ? null : (
          <s-banner tone="info" heading="Remarque pour la livraison">
            {task.note}
          </s-banner>
        )}
        <TaskActions task={task} invoice={invoice} fetcher={fetcher} emailConfigured={emailConfigured} today={today} />
        {result === undefined ? null : <ActionFeedback result={result} />}
        {invoice === null && beforeDelivery ? (
          <s-text color="subdued">{`La facture se fait toute seule quand vous touchez «\u00A0${mode.doneAction}\u00A0».`}</s-text>
        ) : null}
      </s-stack>
    </s-section>
  );
}
