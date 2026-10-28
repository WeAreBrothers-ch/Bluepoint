import type { FetcherWithComponents } from "react-router";
import type { AgendaActionResult, AgendaIntent } from "../../lib/agenda/action-result";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";

/** Boutons d'une tâche. Tous désactivés pendant qu'une action est en cours. */

interface TaskActionsProps {
  readonly task: ScheduledTask;
  readonly invoice: InvoiceRef | null;
  readonly fetcher: FetcherWithComponents<AgendaActionResult>;
}

function pendingIntent(fetcher: FetcherWithComponents<AgendaActionResult>): AgendaIntent | null {
  if (fetcher.state === "idle") return null;
  const intent = fetcher.formData?.get("intent");
  return intent === "livrer" || intent === "facturer" ? intent : null;
}

export function TaskActions({ task, invoice, fetcher }: TaskActionsProps) {
  const pending = pendingIntent(fetcher);
  const busy = pending !== null;
  const submit = (intent: AgendaIntent) => fetcher.submit({ intent, orderId: task.orderId }, { method: "post" });
  const delivered = task.status === "livree";
  const canInvoice = task.status === "livree" || task.status === "expediee";
  const createdInvoice = fetcher.data?.ok ? fetcher.data.invoice : null;
  const shownInvoice = invoice ?? createdInvoice;

  return (
    <s-stack direction="inline" gap="small-200">
      {delivered ? null : (
        <s-button
          variant="primary"
          icon="check"
          onClick={() => submit("livrer")}
          accessibilityLabel={`Marquer livrée la commande ${task.name}`}
          {...(pending === "livrer" ? { loading: true } : {})}
          {...(busy ? { disabled: true } : {})}
        >
          Marquer livrée
        </s-button>
      )}
      {canInvoice && shownInvoice === null ? (
        <s-button
          icon="receipt"
          onClick={() => submit("facturer")}
          {...(pending === "facturer" ? { loading: true } : {})}
          {...(busy ? { disabled: true } : {})}
        >
          Générer la facture
        </s-button>
      ) : null}
      {shownInvoice === null ? null : (
        <s-button icon="receipt" href={`/app/factures#facture-${shownInvoice.id}`}>
          {`Facture ${shownInvoice.number}`}
        </s-button>
      )}
    </s-stack>
  );
}
