import { useFetcher } from "react-router";
import { shortDay } from "../../lib/agenda/dates";
import type { FacturesActionResult, InvoiceListItem } from "../../lib/factures/list-item";
import { formatChf } from "../../lib/format/money";
import { parseIsoDate } from "../../lib/metafields/definitions";
import { ClientCard } from "../ClientCard";
import { FILL } from "../fill";
import { InvoicePaymentButtons } from "./InvoicePaymentButtons";
import { InvoiceResultBanner, InvoiceShortcutButtons } from "./InvoiceShortcutButtons";

/** Une facture : montant, client, dates en toutes lettres, payée ou non, puis les actions. */

interface InvoiceCardProps {
  readonly invoice: InvoiceListItem;
  readonly emailConfigured: boolean;
}

function day(value: string): string {
  const date = parseIsoDate(value);
  return date === null ? value : shortDay(date);
}

function StatusBadge({ invoice }: { readonly invoice: InvoiceListItem }) {
  if (invoice.paymentState === "payee") return <s-badge tone="success">Le client a déjà payé</s-badge>;
  if (invoice.paymentState === "en_retard") {
    return <s-badge tone="critical">{`Paiement en retard de ${invoice.overdueDays} jour${invoice.overdueDays > 1 ? "s" : ""}`}</s-badge>;
  }
  return <s-badge tone="warning">Pas encore payée</s-badge>;
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

export function InvoiceCard({ invoice, emailConfigured }: InvoiceCardProps) {
  const late = invoice.paymentState === "en_retard";
  const reminding = canRemind({ invoice, emailConfigured });
  return (
    <ClientCard
      id={`facture-${invoice.id}`}
      header={
        <>
          <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
            <s-heading>{invoice.customerName}</s-heading>
            <s-text type="strong">{formatChf(invoice.totalCents)}</s-text>
          </s-stack>
          <s-text color="subdued">{`Facture ${invoice.number}`}</s-text>
          <s-stack direction="inline" gap="small-200">
            <StatusBadge invoice={invoice} />
          </s-stack>
        </>
      }
    >
      <s-stack direction="block" gap="small-200">
        {invoice.orderPath === null ? null : <s-link href={invoice.orderPath}>{`Voir la commande ${invoice.orderName}`}</s-link>}
        {invoice.paidOn !== null ? (
          <s-text color="subdued">{`Reçu remis le ${day(invoice.paidOn)}`}</s-text>
        ) : (
          <>
            <s-text {...(late ? { tone: "critical" as const } : {})} type="strong">{`À payer avant le ${day(invoice.dueDate)}`}</s-text>
            <s-text color="subdued">{`Facture faite le ${day(invoice.issueDate)}`}</s-text>
          </>
        )}
      </s-stack>
        {/* En retard : relancer d'abord ; sinon, envoyer la facture. */}
        <Reminders invoice={invoice} emailConfigured={emailConfigured} />
        <InvoiceShortcutButtons invoice={invoice} hideSend={reminding} />
        {invoice.paymentState === "payee" ? null : <InvoicePaymentButtons invoiceId={invoice.id} invoiceNumber={invoice.number} />}
    </ClientCard>
  );
}
