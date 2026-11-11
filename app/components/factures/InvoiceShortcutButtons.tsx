import { COMPLETER_ENTREPRISE } from "../../lib/titres";
import { useFetcher } from "react-router";
import { FILL } from "../fill";
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
  /** Facture en retard : on propose de relancer le client, pas de lui renvoyer la facture. */
  readonly hideSend?: boolean;
  /** Dans une carte de l'agenda : aucun bouton foncé (il n'y en a qu'un, « J'ai livré »), et le numéro de la facture dans la phrase. */
  readonly quiet?: boolean;
}

export function InvoiceResultBanner({ result }: { readonly result: FacturesActionResult | undefined }) {
  if (result === undefined) return null;
  return (
    <s-banner tone={result.ok ? "success" : "critical"} heading={result.message}>
      {!result.ok && result.settingsLink ? <s-link href="/app/reglages">{COMPLETER_ENTREPRISE}</s-link> : null}
    </s-banner>
  );
}

export function InvoiceShortcutButtons({ invoice, hideSend = false, quiet = false }: InvoiceShortcutButtonsProps) {
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-envoi-${invoice.id}` });
  const drafts = useInvoiceDrafts(invoice.id);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const canEmail = invoice.customerEmail !== null;
  const emailModalId = `envoi-email-${invoice.id}`;
  const whatsappModalId = `envoi-whatsapp-${invoice.id}`;

  const whatsapp = invoice.whatsappAvailable ? (
    <s-button
      key="whatsapp"
      {...FILL}
      icon="chat"
      commandFor={whatsappModalId}
      command="--show"
      onClick={drafts.load}
      accessibilityLabel="Envoyer la facture par WhatsApp"
      variant={!quiet && invoice.preferredChannel === "whatsapp" ? "primary" : "secondary"}
      {...(busy ? { disabled: true } : {})}
    >
      WhatsApp
    </s-button>
  ) : null;
  const email = canEmail ? (
    <s-button
      key="email"
      {...FILL}
      icon="email"
      commandFor={emailModalId}
      command="--show"
      onClick={drafts.load}
      accessibilityLabel="Envoyer la facture par e-mail"
      variant={!quiet && (invoice.preferredChannel === "email" || !invoice.whatsappAvailable) ? "primary" : "secondary"}
      {...(busy ? { disabled: true } : {})}
    >
      E-mail
    </s-button>
  ) : null;
  const channels = (invoice.preferredChannel === "email" ? [email, whatsapp] : [whatsapp, email]).filter((button) => button !== null);

  return (
    <s-stack direction="block" gap="small-200">
      {hideSend ? null : channels.length === 0 ? (
        /* Ni WhatsApp ni e-mail : une seule phrase utile, pas d'explication technique. */
        <s-text color="subdued">Imprimez la facture et donnez-la avec la commande.</s-text>
      ) : (
        <>
          <s-text type="strong">{`${invoice.sentLabel === null ? "Envoyer" : "Renvoyer"} la facture${quiet ? ` ${invoice.number}` : ""} au client`}</s-text>
          {invoice.sentLabel === null ? null : <s-text color="subdued">{invoice.sentLabel}</s-text>}
          <s-grid gridTemplateColumns={channels.length === 1 ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)"} gap="small-200">
            {channels}
          </s-grid>
        </>
      )}
      <s-stack direction="inline">
        <s-button icon="view" variant="tertiary" href={invoice.viewUrl} target="_blank">
          Voir ou imprimer la facture
        </s-button>
      </s-stack>
      <InvoiceResultBanner result={result} />
      {canEmail ? (
        <InvoiceEmailModal
          modalId={emailModalId}
          invoiceId={invoice.id}
          drafts={drafts}
          fetcher={fetcher}
          onMailboxOpened={() =>
            fetcher.submit({ intent: "email_ouvert", invoiceId: invoice.id }, { method: "post", action: "/app/factures" })
          }
        />
      ) : null}
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
