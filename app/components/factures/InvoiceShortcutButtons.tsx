import { useFetcher } from "react-router";
import type { FacturesActionResult, InvoiceShortcuts } from "../../lib/factures/list-item";
import { InvoiceEmailModal } from "./InvoiceEmailModal";
import { InvoiceWhatsappModal } from "./InvoiceWhatsappModal";
import { useInvoiceDrafts } from "./useInvoiceDrafts";

/**
 * Voir et envoyer une facture, depuis la liste des factures ou la carte de l'agenda.
 * Le canal déjà utilisé pour ce client est proposé en premier (bouton principal).
 * « Envoyer par e-mail » et « Envoyer par WhatsApp » ouvrent une fenêtre avec le message déjà rédigé
 * (vins de la commande, total, échéance) : on le relit, on le modifie si besoin, puis on envoie.
 */

interface InvoiceShortcutButtonsProps {
  readonly invoice: InvoiceShortcuts;
  readonly emailConfigured: boolean;
}

export function InvoiceResultBanner({ result }: { readonly result: FacturesActionResult | undefined }) {
  if (result === undefined) return null;
  return (
    <s-banner tone={result.ok ? "success" : "critical"} heading={result.message}>
      {!result.ok && result.settingsLink ? <s-link href="/app/reglages">Compléter mes coordonnées</s-link> : null}
    </s-banner>
  );
}

export function InvoiceShortcutButtons({ invoice, emailConfigured }: InvoiceShortcutButtonsProps) {
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-envoi-${invoice.id}` });
  const drafts = useInvoiceDrafts(invoice.id);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const canEmail = emailConfigured && invoice.customerEmail !== null;
  const emailModalId = `envoi-email-${invoice.id}`;
  const whatsappModalId = `envoi-whatsapp-${invoice.id}`;

  const whatsapp = invoice.whatsappAvailable ? (
    <s-button
      key="whatsapp"
      icon="chat"
      commandFor={whatsappModalId}
      command="--show"
      onClick={drafts.load}
      variant={invoice.preferredChannel === "whatsapp" ? "primary" : "secondary"}
      {...(busy ? { disabled: true } : {})}
    >
      Envoyer par WhatsApp
    </s-button>
  ) : null;
  const email = canEmail ? (
    <s-button
      key="email"
      icon="email"
      commandFor={emailModalId}
      command="--show"
      onClick={drafts.load}
      variant={invoice.preferredChannel === "email" || !invoice.whatsappAvailable ? "primary" : "secondary"}
      {...(busy ? { disabled: true } : {})}
    >
      Envoyer par e-mail
    </s-button>
  ) : null;
  const ordered = invoice.preferredChannel === "email" ? [email, whatsapp] : [whatsapp, email];

  return (
    <s-stack direction="block" gap="small-200">
      <s-stack direction="inline" gap="small-200">
        {ordered}
        <s-button icon="view" href={invoice.viewUrl} target="_blank">
          Voir ou imprimer la facture
        </s-button>
      </s-stack>
      {invoice.sentLabel === null ? null : <s-text color="subdued">{invoice.sentLabel}</s-text>}
      {/* Ni WhatsApp ni e-mail : une seule phrase utile, pas d'explication technique. */}
      {!invoice.whatsappAvailable && !canEmail ? (
        <s-text color="subdued">Imprimez la facture et donnez-la avec la commande.</s-text>
      ) : null}
      <InvoiceResultBanner result={result} />
      {canEmail ? <InvoiceEmailModal modalId={emailModalId} invoiceId={invoice.id} drafts={drafts} fetcher={fetcher} /> : null}
      {invoice.whatsappAvailable ? (
        <InvoiceWhatsappModal
          modalId={whatsappModalId}
          drafts={drafts}
          onOpened={() =>
            fetcher.submit({ intent: "whatsapp", invoiceId: invoice.id }, { method: "post", action: "/app/factures" })
          }
        />
      ) : null}
    </s-stack>
  );
}
