import { useState } from "react";
import { useFetcher } from "react-router";
import { downloadInvoicePdf } from "../../lib/factures/download.client";
import type { FacturesActionResult, InvoiceListItem } from "../../lib/factures/list-item";
import { useToastOnce } from "../useToastOnce";

/** Télécharger, envoyer par e-mail, envoyer par WhatsApp. */

interface InvoiceActionsProps {
  readonly invoice: InvoiceListItem;
  readonly emailConfigured: boolean;
}

function useDownload(invoice: InvoiceListItem) {
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    setDownloading(true);
    const ok = await downloadInvoicePdf(invoice.id, `Facture-${invoice.number}.pdf`);
    setDownloading(false);
    if (!ok) shopify.toast.show("Le PDF n’a pas pu être téléchargé. Réessayez.", { isError: true });
  };
  return { downloading, download };
}

function emailHint(invoice: InvoiceListItem, emailConfigured: boolean): string | null {
  if (!emailConfigured) return "L’envoi par e-mail n’est pas encore activé. Télécharger le PDF reste possible.";
  return invoice.customerEmail === null ? "Aucune adresse e-mail connue pour ce client." : null;
}

export function InvoiceActions({ invoice, emailConfigured }: InvoiceActionsProps) {
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-${invoice.id}` });
  const { downloading, download } = useDownload(invoice);
  const busy = fetcher.state !== "idle";
  const sendingEmail = busy && fetcher.formData?.get("intent") === "email";
  const hint = emailHint(invoice, emailConfigured);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  useToastOnce(result, result?.message ?? null, result !== undefined && !result.ok);

  return (
    <s-stack direction="block" gap="small-200">
      <s-stack direction="inline" gap="small-200">
        <s-button icon="download" onClick={() => void download()} {...(downloading ? { loading: true } : {})}>
          Télécharger
        </s-button>
        <s-button
          icon="email"
          onClick={() => fetcher.submit({ intent: "email", invoiceId: invoice.id }, { method: "post" })}
          {...(sendingEmail ? { loading: true } : {})}
          {...(busy || hint !== null ? { disabled: true } : {})}
        >
          Envoyer par e-mail
        </s-button>
        {invoice.whatsappUrl === null ? null : (
          <s-button
            icon="chat"
            href={invoice.whatsappUrl}
            target="_blank"
            onClick={() => fetcher.submit({ intent: "whatsapp", invoiceId: invoice.id }, { method: "post" })}
            {...(busy ? { disabled: true } : {})}
          >
            WhatsApp
          </s-button>
        )}
      </s-stack>
      {hint === null ? null : <s-text color="subdued">{hint}</s-text>}
      {invoice.whatsappUrl === null ? <s-text color="subdued">{"WhatsApp\u202F: aucun numéro de portable connu."}</s-text> : null}
      {result !== undefined && !result.ok && result.settingsLink ? <s-link href="/app/reglages">Compléter les réglages</s-link> : null}
    </s-stack>
  );
}
