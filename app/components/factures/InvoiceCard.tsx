import { useState } from "react";
import { useFetcher } from "react-router";
import { shortDay } from "../../lib/agenda/dates";
import type { FacturesActionResult, InvoiceListItem } from "../../lib/factures/list-item";
import { paymentBadge } from "../../lib/factures/payment";
import { formatChf } from "../../lib/format/money";
import { parseIsoDate } from "../../lib/metafields/definitions";
import { ClientCard } from "../ClientCard";
import { FILL } from "../fill";
import { InvoicePaymentButtons } from "./InvoicePaymentButtons";
import { InvoiceResultBanner, InvoiceShortcutButtons } from "./InvoiceShortcutButtons";

interface InvoiceCardProps {
  readonly invoice: InvoiceListItem;
  readonly emailConfigured: boolean;
}

function day(value: string): string {
  const date = parseIsoDate(value);
  return date === null ? value : shortDay(date);
}

function StatusBadge({ invoice }: { readonly invoice: InvoiceListItem }) {
  const badge = paymentBadge(invoice.paymentState, invoice.overdueDays);
  return <s-badge tone={badge.tone}>{badge.label}</s-badge>;
}

/** Facture en retard, et au moins un moyen de relancer le client. */
function canRemind({ invoice, emailConfigured }: InvoiceCardProps): boolean {
  return invoice.paymentState === "en_retard" && (invoice.reminderWhatsappUrl !== null || (emailConfigured && invoice.customerEmail !== null));
}

/** Relance d'une facture en retard : même principe que l'envoi, une ligne et deux choix. */
function Reminders({ invoice, emailConfigured }: InvoiceCardProps) {
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-relance-${invoice.id}` });
  const busy = fetcher.state !== "idle";
  const canEmail = emailConfigured && invoice.customerEmail !== null;
  if (!canRemind({ invoice, emailConfigured })) return null;
  const buttons = [
    invoice.reminderWhatsappUrl === null ? null : (
      <s-button key="wa" {...FILL} icon="chat" href={invoice.reminderWhatsappUrl} target="_blank" tone="critical" accessibilityLabel="Relancer par WhatsApp">
        WhatsApp
      </s-button>
    ),
    canEmail ? (
      <s-button
        key="mail"
        {...FILL}
        icon="email"
        tone="critical"
        accessibilityLabel="Relancer par e-mail"
        onClick={() => fetcher.submit({ intent: "relance_email", invoiceId: invoice.id }, { method: "post", action: "/app/factures" })}
        {...(busy ? { loading: true } : {})}
      >
        E-mail
      </s-button>
    ) : null,
  ].filter((button) => button !== null);
  return (
    <s-stack direction="block" gap="small-200">
      <s-text type="strong">Relancer le client (paiement en retard)</s-text>
      <s-grid gridTemplateColumns={buttons.length === 1 ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)"} gap="small-200">
        {buttons}
      </s-grid>
      <InvoiceResultBanner result={fetcher.state === "idle" ? fetcher.data : undefined} />
    </s-stack>
  );
}

/** Ce qu'il faut faire maintenant avec cette facture : un seul geste mis en avant. */
type MainAction = "relancer" | "envoyer" | "imprimer" | "encaisser" | "aucune";

function mainAction(invoice: InvoiceListItem, reminding: boolean): MainAction {
  if (invoice.paymentState === "payee") return "aucune";
  if (reminding) return "relancer";
  if (invoice.sentLabel !== null) return "encaisser";
  return invoice.whatsappAvailable || invoice.customerEmail !== null ? "envoyer" : "imprimer";
}

/**
 * Une facture : qui, combien, où on en est, puis UN bouton (relancer, envoyer, ou « Le client a payé »).
 * Tout le reste (renvoyer, voir ou imprimer, noter le paiement, voir la commande) est sous « Autres actions » :
 * rien n'est perdu, mais la carte reste courte et on sait tout de suite quoi faire.
 */
export function InvoiceCard({ invoice, emailConfigured }: InvoiceCardProps) {
  const [open, setOpen] = useState(false);
  const late = invoice.paymentState === "en_retard";
  const paid = invoice.paymentState === "payee";
  const reminding = canRemind({ invoice, emailConfigured });
  const main = mainAction(invoice, reminding);
  const view = (
    <s-grid gridTemplateColumns="minmax(0, 1fr)">
      <s-button {...FILL} icon="view" variant={main === "imprimer" ? "secondary" : "tertiary"} href={invoice.viewUrl} target="_blank">
        Voir ou imprimer la facture
      </s-button>
    </s-grid>
  );
  const payment = <InvoicePaymentButtons invoiceId={invoice.id} invoiceNumber={invoice.number} />;
  return (
    <ClientCard
      id={`facture-${invoice.id}`}
      header={
        <>
          <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
            <s-heading>{invoice.customerName}</s-heading>
            <s-heading>{formatChf(invoice.totalCents)}</s-heading>
          </s-grid>
          <s-text color="subdued">{`Facture ${invoice.number}`}</s-text>
          <s-stack direction="inline">
            <StatusBadge invoice={invoice} />
          </s-stack>
        </>
      }
    >
      {paid ? (
        <s-text>{invoice.paidOn === null ? "Payée" : `Payée le ${day(invoice.paidOn)}`}</s-text>
      ) : (
        <s-text {...(late ? { tone: "critical" as const } : {})} type="strong">{`À payer avant le ${day(invoice.dueDate)}`}</s-text>
      )}
      {main === "relancer" ? <Reminders invoice={invoice} emailConfigured={emailConfigured} /> : null}
      {main === "envoyer" ? <InvoiceShortcutButtons invoice={invoice} hideView /> : null}
      {main === "imprimer" ? view : null}
      {main === "encaisser" ? payment : null}
      {open ? (
        <s-box padding="small-300" background="subdued" borderRadius="base">
          <s-stack direction="block" gap="small-300">
            {/* Renvoyer la facture (pas quand elle est en retard : on relance). */}
            {main === "envoyer" || main === "imprimer" || reminding ? null : <InvoiceShortcutButtons invoice={invoice} hideView />}
            {main === "imprimer" ? null : view}
            {paid || main === "encaisser" ? null : payment}
            {invoice.orderPath === null ? null : (
              <s-grid gridTemplateColumns="minmax(0, 1fr)">
                <s-button {...FILL} variant="tertiary" icon="order" href={invoice.orderPath}>
                  {`Voir la commande ${invoice.orderName}`}
                </s-button>
              </s-grid>
            )}
          </s-stack>
        </s-box>
      ) : null}
      <s-grid gridTemplateColumns="minmax(0, 1fr)">
        <s-button {...FILL} variant="tertiary" icon={open ? "chevron-up" : "chevron-down"} onClick={() => setOpen((value) => !value)}>
          {open ? "Moins d’actions" : "Autres actions"}
        </s-button>
      </s-grid>
    </ClientCard>
  );
}
