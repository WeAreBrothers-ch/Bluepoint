import { Fragment, useState, type ReactNode } from "react";
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
 * Boutons d'une tâche : un seul gros bouton foncé (ce qu'il faut faire maintenant), les autres en simples liens
 * dessous. « J'ai livré la commande » demande une confirmation avant d'agir :
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

  // Chaque action sait se dessiner « en gros » (le seul bouton foncé de la carte) ou « en petit » (un simple lien).
  interface Action {
    readonly key: string;
    readonly render: (main: boolean) => ReactNode;
  }
  const chooseDay: Action | null = canReschedule
    ? {
        key: "jour",
        render: (main) => (
          <ActionButton main={main} icon="calendar" onClick={() => setPanel("jour")} loading={pending === "dater"} disabled={busy}>
            {undated ? mode.chooseDay : "Changer le jour"}
          </ActionButton>
        ),
      }
    : null;
  const deliver: Action | null = delivered
    ? null
    : {
        key: "livrer",
        render: (main) => (
          <ActionButton
            main={main}
            icon="check"
            onClick={() => setPanel("confirmer")}
            label={`${mode.doneAction} : commande ${task.name}`}
            loading={pending === "livrer"}
            disabled={busy}
          >
            {mode.doneAction}
          </ActionButton>
        ),
      };
  const makeInvoice: Action | null = invoiceButton
    ? {
        key: "facturer",
        render: (main) => (
          <ActionButton main={main} icon="receipt" onClick={() => submit("facturer")} loading={pending === "facturer"} disabled={busy}>
            Faire la facture
          </ActionButton>
        ),
      }
    : null;
  const seeInvoice: Action | null =
    createdInvoice === null
      ? null
      : {
          key: "voir-facture",
          render: (main) => (
            <ActionButton main={main} icon="receipt" href={`/app/factures?vue=toutes#facture-${createdInvoice.id}`}>
              {`Voir la facture ${createdInvoice.number}`}
            </ActionButton>
          ),
        };
  const viewOrder: Action | null =
    viewOrderHref === undefined
      ? null
      : { key: "commande", render: (main) => <ActionButton main={main} icon="order" href={viewOrderHref}>Voir la commande</ActionButton> };

  // Le bouton foncé est réservé à ce qu'il faut FAIRE (livrer, choisir le jour, faire la facture) : le premier de ces
  // gestes. Tout le reste, y compris « Voir la commande » et « Voir la facture », n'est qu'un lien.
  const todo = [...(undated ? [chooseDay, deliver] : [deliver, chooseDay]), makeInvoice].filter((action) => action !== null);
  const links = [seeInvoice, viewOrder].filter((action) => action !== null);
  const [main, ...secondary] = todo;
  const smaller = [...secondary, ...links];

  return (
    <s-stack direction="block" gap="base">
      {main === undefined && smaller.length === 0 ? null : (
        <s-stack direction="block" gap="small-200">
          {main === undefined ? null : <s-grid gridTemplateColumns="minmax(0, 1fr)">{main.render(true)}</s-grid>}
          {smaller.length === 0 ? null : (
            <s-stack direction="inline" gap="small-100 base" alignItems="center">
              {smaller.map((action) => (
                <Fragment key={action.key}>{action.render(false)}</Fragment>
              ))}
            </s-stack>
          )}
        </s-stack>
      )}
      {invoice === null ? null : (
        <s-stack direction="block" gap="small-200">
          <s-divider />
          <InvoiceShortcutButtons invoice={invoice} emailConfigured={emailConfigured} quiet earlyPayment={awaitsPayment(task) ? invoice.earlyPayment : null} />
          {awaitsPayment(task) ? <InvoicePaymentButtons invoiceId={invoice.id} invoiceNumber={invoice.number} earlyPayment={invoice.earlyPayment} /> : null}
        </s-stack>
      )}
    </s-stack>
  );
}

interface ActionButtonProps {
  readonly main: boolean;
  readonly icon: "calendar" | "check" | "receipt" | "order";
  readonly children: string;
  readonly onClick?: () => void;
  readonly href?: string;
  readonly label?: string;
  readonly loading?: boolean;
  readonly disabled?: boolean;
}

/** Bouton de carte : foncé et sur toute la largeur s'il est LE bouton, sinon un simple lien avec son icône. */
function ActionButton({ main, icon, children, onClick, href, label, loading = false, disabled = false }: ActionButtonProps) {
  return (
    <s-button
      {...(main ? FILL : {})}
      icon={icon}
      variant={main ? "primary" : "tertiary"}
      {...(onClick === undefined ? {} : { onClick })}
      {...(href === undefined ? {} : { href })}
      {...(label === undefined ? {} : { accessibilityLabel: label })}
      {...(loading ? { loading: true } : {})}
      {...(disabled ? { disabled: true } : {})}
    >
      {children}
    </s-button>
  );
}
