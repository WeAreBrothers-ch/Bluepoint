import { useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { AgendaActionResult, AgendaIntent } from "../../lib/agenda/action-result";
import { modeLabel } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import type { IsoDate } from "../../lib/metafields/definitions";
import { InvoicePaymentButtons } from "../factures/InvoicePaymentButtons";
import { InvoiceShortcutButtons } from "../factures/InvoiceShortcutButtons";
import { DayChoicePanel } from "./DeliveryDayPicker";

/**
 * Boutons d'une tâche, sur une seule ligne. « J'ai livré la commande » demande une confirmation avant d'agir :
 * l'action prévient Shopify et fait la facture, on ne la déclenche pas par un toucher malheureux.
 * Une commande sans date (souvent venue du site) propose d'abord « Choisir le jour ».
 * Tous les boutons sont désactivés pendant qu'une action est en cours.
 */

interface TaskActionsProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
  readonly fetcher: FetcherWithComponents<AgendaActionResult>;
  readonly emailConfigured: boolean;
  readonly today: IsoDate;
}

/** Panneau ouvert à la place des boutons : confirmation de la livraison ou choix du jour. */
type Panel = "aucun" | "confirmer" | "jour";

/** La commande n'est pas encore payée : on propose « Le client a payé » sous la facture. */
function awaitsPayment(task: ScheduledTask): boolean {
  return task.financialStatus === "PENDING" || task.financialStatus === "PARTIALLY_PAID" || task.financialStatus === "AUTHORIZED";
}

function pendingIntent(fetcher: FetcherWithComponents<AgendaActionResult>): AgendaIntent | null {
  if (fetcher.state === "idle") return null;
  const intent = fetcher.formData?.get("intent");
  return intent === "livrer" || intent === "facturer" || intent === "dater" ? intent : null;
}

export function TaskActions({ task, invoice, fetcher, emailConfigured, today }: TaskActionsProps) {
  const [panel, setPanel] = useState<Panel>("aucun");
  const pending = pendingIntent(fetcher);
  const busy = pending !== null;
  const submit = (intent: AgendaIntent) => fetcher.submit({ intent, orderId: task.orderId }, { method: "post" });
  const mode = modeLabel(task.mode);
  const delivered = task.status === "livree";
  const canInvoice = task.status === "livree" || task.status === "expediee";
  const canReschedule = task.status === "a_livrer" || task.status === "partielle";
  const undated = task.plannedDate === null;
  // Juste après la livraison, avant le rechargement : on connaît seulement le numéro de la facture.
  const createdInvoice = invoice === null && fetcher.data?.ok ? fetcher.data.invoice : null;
  const disabled = busy ? { disabled: true } : {};

  if (panel === "confirmer" && !delivered) {
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{mode.doneQuestion(task.name)}</s-text>
          <s-text>La facture sera faite tout de suite après.</s-text>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="primary"
              icon="check"
              onClick={() => {
                setPanel("aucun");
                submit("livrer");
              }}
            >
              {`Oui, ${mode.doneAction.charAt(0).toLocaleLowerCase("fr-CH")}${mode.doneAction.slice(1)}`}
            </s-button>
            <s-button icon="x" onClick={() => setPanel("aucun")}>
              Non, annuler
            </s-button>
          </s-stack>
        </s-stack>
      </s-box>
    );
  }

  if (panel === "jour" && canReschedule) {
    return (
      <DayChoicePanel
        task={task}
        today={today}
        onCancel={() => setPanel("aucun")}
        onChoose={(date) => {
          setPanel("aucun");
          fetcher.submit({ intent: "dater", orderId: task.orderId, date, deadline: task.deadline ?? "" }, { method: "post" });
        }}
      />
    );
  }

  const dayButton = canReschedule ? (
    <s-button
      icon="calendar"
      variant={undated ? "primary" : "secondary"}
      onClick={() => setPanel("jour")}
      {...(pending === "dater" ? { loading: true } : {})}
      {...disabled}
    >
      {undated ? mode.chooseDay : "Changer le jour"}
    </s-button>
  ) : null;

  const invoiceButton = canInvoice && invoice === null && createdInvoice === null;
  // Livrée et facturée : plus de bouton sur la ligne, seulement la facture en dessous.
  const hasButtons = !delivered || canReschedule || invoiceButton || createdInvoice !== null;

  return (
    <s-stack direction="block" gap="base">
      {hasButtons ? (
        <s-stack direction="inline" gap="small-200">
          {/* Sans date, choisir le jour vient en premier. */}
          {undated ? dayButton : null}
          {delivered ? null : (
            <s-button
              variant={undated ? "secondary" : "primary"}
              icon="check"
              onClick={() => setPanel("confirmer")}
              accessibilityLabel={`${mode.doneAction} : commande ${task.name}`}
              {...(pending === "livrer" ? { loading: true } : {})}
              {...disabled}
            >
              {mode.doneAction}
            </s-button>
          )}
          {undated ? null : dayButton}
          {invoiceButton ? (
            <s-button icon="receipt" onClick={() => submit("facturer")} {...(pending === "facturer" ? { loading: true } : {})} {...disabled}>
              Faire la facture
            </s-button>
          ) : null}
          {createdInvoice === null ? null : (
            <s-button icon="receipt" href={`/app/factures?vue=toutes#facture-${createdInvoice.id}`}>
              {`Voir la facture ${createdInvoice.number}`}
            </s-button>
          )}
        </s-stack>
      ) : null}
      {invoice === null ? null : (
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{`Facture ${invoice.number}`}</s-text>
          <InvoiceShortcutButtons invoice={invoice} emailConfigured={emailConfigured} />
          {awaitsPayment(task) ? <InvoicePaymentButtons invoiceId={invoice.id} invoiceNumber={invoice.number} /> : null}
        </s-stack>
      )}
    </s-stack>
  );
}
