import { useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { AgendaActionResult, AgendaIntent } from "../../lib/agenda/action-result";
import { modeLabel } from "../../lib/agenda/labels";
import type { InvoiceRef, ScheduledTask } from "../../lib/agenda/types";
import type { IsoDate } from "../../lib/metafields/definitions";
import { InvoicePaymentButtons } from "../factures/InvoicePaymentButtons";
import { InvoiceShortcutButtons } from "../factures/InvoiceShortcutButtons";
import { FILL } from "../fill";
import { DayChoicePanel } from "./DeliveryDayPicker";

/**
 * Boutons d'une tâche : un seul gros bouton en haut (ce qu'il faut faire maintenant), les autres en dessous,
 * plus discrets, deux par ligne. « J'ai livré la commande » demande une confirmation avant d'agir :
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
  /** Lien « Voir la commande », sur la carte de l'agenda seulement (sur la fiche commande, on y est déjà). */
  readonly viewOrderHref?: string;
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

export function TaskActions({ task, invoice, fetcher, emailConfigured, today, viewOrderHref }: TaskActionsProps) {
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

  const invoiceButton = canInvoice && invoice === null && createdInvoice === null;
  const dayFirst = undated; // sans date, « Choisir le jour » passe avant la livraison

  const chooseDay = canReschedule ? (
    <s-button
      key="jour"
      {...FILL}
      icon="calendar"
      variant={dayFirst ? "primary" : "secondary"}
     
      onClick={() => setPanel("jour")}
      {...(pending === "dater" ? { loading: true } : {})}
      {...disabled}
    >
      {undated ? mode.chooseDay : "Changer le jour"}
    </s-button>
  ) : null;
  const deliver = delivered ? null : (
    <s-button
      key="livrer"
      {...FILL}
      variant={undated ? "secondary" : "primary"}
      icon="check"
     
      onClick={() => setPanel("confirmer")}
      accessibilityLabel={`${mode.doneAction} : commande ${task.name}`}
      {...(pending === "livrer" ? { loading: true } : {})}
      {...disabled}
    >
      {mode.doneAction}
    </s-button>
  );
  const makeInvoice = invoiceButton ? (
    <s-button
      key="facturer"
      {...FILL}
      icon="receipt"
      variant={delivered ? "primary" : "secondary"}
     
      onClick={() => submit("facturer")}
      {...(pending === "facturer" ? { loading: true } : {})}
      {...disabled}
    >
      Faire la facture
    </s-button>
  ) : null;
  const seeInvoice =
    createdInvoice === null ? null : (
      <s-button key="voir-facture" {...FILL} icon="receipt" variant="primary" href={`/app/factures?vue=toutes#facture-${createdInvoice.id}`}>
        {`Voir la facture ${createdInvoice.number}`}
      </s-button>
    );
  const viewOrder =
    viewOrderHref === undefined ? null : (
      <s-button key="commande" {...FILL} icon="order" href={viewOrderHref}>
        Voir la commande
      </s-button>
    );

  // Le premier de la liste est LE bouton : il prend toute la largeur. Les suivants sont rangés deux par deux.
  const buttons = [
    ...(undated ? [chooseDay, deliver] : [deliver, chooseDay]),
    makeInvoice,
    seeInvoice,
    viewOrder,
  ].filter((button) => button !== null);
  const [main, ...others] = buttons;

  return (
    <s-stack direction="block" gap="base">
      {main === undefined ? null : (
        <s-grid gridTemplateColumns="minmax(0, 1fr) minmax(0, 1fr)" gap="small-200">
          <s-grid-item gridColumn="span 2">{main}</s-grid-item>
          {others}
        </s-grid>
      )}
      {invoice === null ? null : (
        <s-stack direction="block" gap="small-200">
          <s-divider />
          <s-text type="strong">{`Facture ${invoice.number}`}</s-text>
          <InvoiceShortcutButtons invoice={invoice} emailConfigured={emailConfigured} />
          {awaitsPayment(task) ? <InvoicePaymentButtons invoiceId={invoice.id} invoiceNumber={invoice.number} /> : null}
        </s-stack>
      )}
    </s-stack>
  );
}
