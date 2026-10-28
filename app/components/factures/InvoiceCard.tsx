import { useFetcher } from "react-router";
import { longDay } from "../../lib/agenda/dates";
import type { FacturesActionResult, InvoiceListItem } from "../../lib/factures/list-item";
import { formatChf } from "../../lib/format/money";
import { parseIsoDate } from "../../lib/metafields/definitions";
import { InvoicePaymentButtons } from "./InvoicePaymentButtons";
import { InvoiceResultBanner, InvoiceShortcutButtons } from "./InvoiceShortcutButtons";

/** Une facture : montant, client, dates en toutes lettres, payée ou non, puis les actions. */

interface InvoiceCardProps {
  readonly invoice: InvoiceListItem;
  readonly emailConfigured: boolean;
}

function day(value: string): string {
  const date = parseIsoDate(value);
  return date === null ? value : longDay(date);
}

function StatusBadge({ invoice }: { readonly invoice: InvoiceListItem }) {
  if (invoice.paymentState === "payee") return <s-badge tone="success">Payée</s-badge>;
  if (invoice.paymentState === "en_retard") {
    return <s-badge tone="critical">{`En retard de ${invoice.overdueDays} jour${invoice.overdueDays > 1 ? "s" : ""}`}</s-badge>;
  }
  return <s-badge tone="warning">À payer</s-badge>;
}

/** Relance d'une facture en retard : WhatsApp prérempli, ou e-mail avec le PDF. */
function Reminders({ invoice, emailConfigured }: InvoiceCardProps) {
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-relance-${invoice.id}` });
  const busy = fetcher.state !== "idle";
  const canEmail = emailConfigured && invoice.customerEmail !== null;
  if (invoice.paymentState !== "en_retard" || (invoice.reminderWhatsappUrl === null && !canEmail)) return null;
  return (
    <s-stack direction="block" gap="small-200">
      <s-stack direction="inline" gap="small-200">
        {invoice.reminderWhatsappUrl === null ? null : (
          <s-button icon="chat" href={invoice.reminderWhatsappUrl} target="_blank" tone="critical">
            Relancer par WhatsApp
          </s-button>
        )}
        {canEmail ? (
          <s-button
            icon="email"
            tone="critical"
            onClick={() => fetcher.submit({ intent: "relance_email", invoiceId: invoice.id }, { method: "post", action: "/app/factures" })}
            {...(busy ? { loading: true } : {})}
          >
            Relancer par e-mail
          </s-button>
        ) : null}
      </s-stack>
      <InvoiceResultBanner result={fetcher.state === "idle" ? fetcher.data : undefined} />
    </s-stack>
  );
}

export function InvoiceCard({ invoice, emailConfigured }: InvoiceCardProps) {
  const dates =
    invoice.paidOn !== null
      ? `Reçu remis le ${day(invoice.paidOn)} (déjà payée)`
      : `Faite le ${day(invoice.issueDate)} · à payer avant le ${day(invoice.dueDate)}`;
  return (
    <s-box padding="base" border="base" borderRadius="base" background="base" id={`facture-${invoice.id}`}>
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
            <s-heading>{invoice.customerName}</s-heading>
            <s-text type="strong">{formatChf(invoice.totalCents)}</s-text>
          </s-stack>
          <s-text color="subdued">{`Facture ${invoice.number} · commande ${invoice.orderName}`}</s-text>
          <s-text>{dates}</s-text>
          <s-stack direction="inline" gap="small-200">
            <StatusBadge invoice={invoice} />
          </s-stack>
        </s-stack>
        <InvoiceShortcutButtons invoice={invoice} emailConfigured={emailConfigured} />
        <Reminders invoice={invoice} emailConfigured={emailConfigured} />
        {invoice.paymentState === "payee" ? null : <InvoicePaymentButtons invoiceId={invoice.id} invoiceNumber={invoice.number} />}
      </s-stack>
    </s-box>
  );
}
