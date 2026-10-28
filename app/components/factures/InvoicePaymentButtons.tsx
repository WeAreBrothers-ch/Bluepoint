import { useState } from "react";
import { useFetcher } from "react-router";
import type { FacturesActionResult } from "../../lib/factures/list-item";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "../../lib/factures/payment";
import { InvoiceResultBanner } from "./InvoiceShortcutButtons";

/**
 * « C'est payé » : un toucher, puis « comment ? » (virement, cash, TWINT). Le paiement est noté
 * dans Shopify ; la facture passe dans « Payées » et la commande devient « Payée » dans l'agenda.
 */

interface InvoicePaymentButtonsProps {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
}

export function InvoicePaymentButtons({ invoiceId, invoiceNumber }: InvoicePaymentButtonsProps) {
  const [choosing, setChoosing] = useState(false);
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-paiement-${invoiceId}` });
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  if (result?.ok) return <InvoiceResultBanner result={result} />;
  if (!choosing) {
    return (
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline">
          <s-button icon="cash-dollar" onClick={() => setChoosing(true)} {...(busy ? { loading: true } : {})}>
            C’est payé
          </s-button>
        </s-stack>
        <InvoiceResultBanner result={result} />
      </s-stack>
    );
  }
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{`Comment le client a-t-il payé la facture ${invoiceNumber}\u202F?`}</s-text>
        <s-stack direction="inline" gap="small-200">
          {PAYMENT_METHODS.map((method) => (
            <s-button
              key={method}
              variant="primary"
              onClick={() => {
                setChoosing(false);
                fetcher.submit({ intent: "payee", invoiceId, method }, { method: "post", action: "/app/factures" });
              }}
            >
              {PAYMENT_METHOD_LABELS[method]}
            </s-button>
          ))}
          <s-button icon="x" onClick={() => setChoosing(false)}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
