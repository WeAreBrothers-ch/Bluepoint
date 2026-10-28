import { useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { AgendaActionResult, AgendaIntent } from "../../lib/agenda/action-result";
import { modeLabel } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import { InvoicePaymentButtons } from "../factures/InvoicePaymentButtons";
import { InvoiceShortcutButtons } from "../factures/InvoiceShortcutButtons";

/**
 * Boutons d'une tâche. « C'est livré » demande une confirmation avant d'agir :
 * l'action prévient Shopify et fait la facture, on ne la déclenche pas par un toucher malheureux.
 * Tous les boutons sont désactivés pendant qu'une action est en cours.
 */

interface TaskActionsProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
  readonly fetcher: FetcherWithComponents<AgendaActionResult>;
  readonly emailConfigured: boolean;
}

/** La commande reste à encaisser : on propose « C'est payé » sous la facture. */
function awaitsPayment(task: ScheduledTask): boolean {
  return task.financialStatus === "PENDING" || task.financialStatus === "PARTIALLY_PAID" || task.financialStatus === "AUTHORIZED";
}

function pendingIntent(fetcher: FetcherWithComponents<AgendaActionResult>): AgendaIntent | null {
  if (fetcher.state === "idle") return null;
  const intent = fetcher.formData?.get("intent");
  return intent === "livrer" || intent === "facturer" ? intent : null;
}

export function TaskActions({ task, invoice, fetcher, emailConfigured }: TaskActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const pending = pendingIntent(fetcher);
  const busy = pending !== null;
  const submit = (intent: AgendaIntent) => fetcher.submit({ intent, orderId: task.orderId }, { method: "post" });
  const mode = modeLabel(task.mode);
  const delivered = task.status === "livree";
  const canInvoice = task.status === "livree" || task.status === "expediee";
  // Juste après « C'est livré », avant le rechargement : on connaît seulement le numéro de la facture.
  const createdInvoice = invoice === null && fetcher.data?.ok ? fetcher.data.invoice : null;

  if (confirming && !delivered) {
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{mode.doneQuestion(task.name)}</s-text>
          <s-text>La facture sera préparée tout de suite après.</s-text>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="primary"
              icon="check"
              onClick={() => {
                setConfirming(false);
                submit("livrer");
              }}
            >
              {`Oui, ${mode.doneAction.charAt(0).toLocaleLowerCase("fr-CH")}${mode.doneAction.slice(1)}`}
            </s-button>
            <s-button icon="x" onClick={() => setConfirming(false)}>
              Non, annuler
            </s-button>
          </s-stack>
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="small-200">
      {delivered ? null : (
        <s-button
          variant="primary"
          icon="check"
          onClick={() => setConfirming(true)}
          accessibilityLabel={`${mode.doneAction} : commande ${task.name}`}
          {...(pending === "livrer" ? { loading: true } : {})}
          {...(busy ? { disabled: true } : {})}
        >
          {mode.doneAction}
        </s-button>
      )}
      {canInvoice && invoice === null && createdInvoice === null ? (
        <s-button
          icon="receipt"
          onClick={() => submit("facturer")}
          {...(pending === "facturer" ? { loading: true } : {})}
          {...(busy ? { disabled: true } : {})}
        >
          Faire la facture
        </s-button>
      ) : null}
      {createdInvoice === null ? null : (
        <s-button icon="receipt" href={`/app/factures?vue=toutes#facture-${createdInvoice.id}`}>
          {`Voir la facture ${createdInvoice.number}`}
        </s-button>
      )}
      </s-stack>
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
