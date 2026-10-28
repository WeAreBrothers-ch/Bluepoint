import { formatChf } from "../../lib/format/money";
import { formatSwissDate } from "../../lib/format/dates";
import { withColon } from "../../lib/format/typography";
import { sentStatus, type InvoiceListItem } from "../../lib/factures/list-item";
import { parseIsoDate } from "../../lib/metafields/definitions";
import { InvoiceActions } from "./InvoiceActions";

/** Une facture de la liste : numéro, client, montant, échéance, statut d'envoi, actions. */

interface InvoiceCardProps {
  readonly invoice: InvoiceListItem;
  readonly emailConfigured: boolean;
}

function swissDate(value: string): string {
  const date = parseIsoDate(value);
  return date === null ? value : formatSwissDate(date);
}

export function InvoiceCard({ invoice, emailConfigured }: InvoiceCardProps) {
  const status = sentStatus(invoice);
  return (
    <s-box padding="base" border="base" borderRadius="base" background="base" id={`facture-${invoice.id}`}>
      <s-stack direction="block" gap="small-300">
        <s-stack direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
          <s-heading>{invoice.number}</s-heading>
          <s-text type="strong">{formatChf(invoice.totalCents)}</s-text>
        </s-stack>
        <s-text>{`${invoice.customerName} · commande ${invoice.orderName}`}</s-text>
        <s-text color="subdued">
          {invoice.paidOn === null
            ? `${withColon("Émise le")} ${swissDate(invoice.issueDate)} · ${withColon("échéance")} ${swissDate(invoice.dueDate)}`
            : `${withColon("Reçu pro acquitté le")} ${swissDate(invoice.paidOn)}`}
        </s-text>
        <s-stack direction="inline" gap="small-200">
          <s-badge tone={status.tone}>{status.label}</s-badge>
        </s-stack>
        <InvoiceActions invoice={invoice} emailConfigured={emailConfigured} />
      </s-stack>
    </s-box>
  );
}
