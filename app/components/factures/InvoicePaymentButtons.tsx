import { useState } from "react";
import { useFetcher } from "react-router";
import type { EarlyPaymentOffer } from "../../lib/escompte/early-payment";
import type { FacturesActionResult } from "../../lib/factures/list-item";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from "../../lib/factures/payment";
import { formatChf } from "../../lib/format/money";
import { FILL } from "../fill";
import { InvoiceResultBanner } from "./InvoiceShortcutButtons";

/**
 * « Le client a payé » : un toucher, puis « quel montant ? » si le rabais de paiement rapide court encore,
 * puis « comment ? » (virement, cash, TWINT). Le paiement est noté dans Shopify ; avec le rabais, la commande
 * est d'abord ajustée de 2 %. La facture passe dans « Payées » et la commande devient « Payée » dans l'agenda.
 */

interface InvoicePaymentButtonsProps {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  /** Rabais encore valable : on demande d'abord quel montant le client a payé. */
  readonly earlyPayment?: EarlyPaymentOffer | null;
}

/** « avec le rabais » ou « montant complet » : ce que le client a réellement payé. */
type Amount = "rabais" | "complet";

export function InvoicePaymentButtons({ invoiceId, invoiceNumber, earlyPayment = null }: InvoicePaymentButtonsProps) {
  const [choosing, setChoosing] = useState(false);
  const [amount, setAmount] = useState<Amount | null>(null);
  const fetcher = useFetcher<FacturesActionResult>({ key: `facture-paiement-${invoiceId}` });
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const cancel = () => {
    setChoosing(false);
    setAmount(null);
  };

  if (result?.ok) return <InvoiceResultBanner result={result} />;
  if (!choosing) {
    return (
      <s-stack direction="block" gap="small-200">
        <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
          <s-button {...FILL} icon="cash-dollar" onClick={() => setChoosing(true)} {...(busy ? { loading: true } : {})}>
            Le client a payé
          </s-button>
        </s-grid>
        <InvoiceResultBanner result={result} />
      </s-stack>
    );
  }

  // Le rabais court encore : d'abord le montant, parce qu'il change ce qui est inscrit dans Shopify.
  if (earlyPayment !== null && amount === null) {
    const percent = String(earlyPayment.percent).replace(".", ",");
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{`Quel montant le client a-t-il payé pour la facture ${invoiceNumber}\u202F?`}</s-text>
          <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
            <s-button {...FILL} variant="primary" icon="check" onClick={() => setAmount("rabais")}>
              {`${formatChf(earlyPayment.amountCents)} — avec le rabais de ${percent}\u202F%`}
            </s-button>
            <s-button {...FILL} onClick={() => setAmount("complet")}>
              {`${formatChf(earlyPayment.amountCents + earlyPayment.discountCents)} — montant complet`}
            </s-button>
            <s-button {...FILL} icon="x" onClick={cancel}>
              Annuler
            </s-button>
          </s-grid>
        </s-stack>
      </s-box>
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
                const withDiscount = amount === "rabais";
                cancel();
                fetcher.submit(
                  { intent: "payee", invoiceId, method, ...(withDiscount ? { rabais: "1" } : {}) },
                  { method: "post", action: "/app/factures" },
                );
              }}
            >
              {PAYMENT_METHOD_LABELS[method]}
            </s-button>
          ))}
          <s-button icon="x" onClick={cancel}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
