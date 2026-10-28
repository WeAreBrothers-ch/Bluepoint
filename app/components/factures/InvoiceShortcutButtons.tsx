import { useFetcher } from "react-router";
import type { FacturesActionResult, InvoiceShortcuts } from "../../lib/factures/list-item";

/**
 * Voir et envoyer une facture en un toucher, depuis la liste des factures ou la carte de l'agenda.
 * Le canal déjà utilisé pour ce client est proposé en premier (bouton principal).
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
  const busy = fetcher.state !== "idle";
  const sendingEmail = busy && fetcher.formData?.get("intent") === "email";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const canEmail = emailConfigured && invoice.customerEmail !== null;
  const send = (intent: "email" | "whatsapp") =>
    fetcher.submit({ intent, invoiceId: invoice.id }, { method: "post", action: "/app/factures" });

  const whatsapp =
    invoice.whatsappUrl === null ? null : (
      <s-button
        key="whatsapp"
        icon="chat"
        href={invoice.whatsappUrl}
        target="_blank"
        variant={invoice.preferredChannel === "whatsapp" ? "primary" : "secondary"}
        onClick={() => send("whatsapp")}
        {...(busy ? { disabled: true } : {})}
      >
        Envoyer par WhatsApp
      </s-button>
    );
  const email = canEmail ? (
    <s-button
      key="email"
      icon="email"
      variant={invoice.preferredChannel === "email" || invoice.whatsappUrl === null ? "primary" : "secondary"}
      onClick={() => send("email")}
      {...(sendingEmail ? { loading: true } : {})}
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
          Voir / imprimer
        </s-button>
      </s-stack>
      {invoice.sentLabel === null ? null : <s-text color="subdued">{invoice.sentLabel}</s-text>}
      {/* Ni WhatsApp ni e-mail : une seule phrase utile, pas d'explication technique. */}
      {invoice.whatsappUrl === null && !canEmail ? (
        <s-text color="subdued">Imprimez la facture et donnez-la avec la commande.</s-text>
      ) : null}
      <InvoiceResultBanner result={result} />
    </s-stack>
  );
}
