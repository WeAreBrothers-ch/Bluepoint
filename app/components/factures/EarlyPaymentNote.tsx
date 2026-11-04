import { shortDay } from "../../lib/agenda/dates";
import type { EarlyPaymentOffer } from "../../lib/escompte/early-payment";
import { formatChf } from "../../lib/format/money";

/** « 2 % de rabais si payée avant le 14 novembre » : l'avantage qui pousse un pro à payer tout de suite. */
export function EarlyPaymentNote({ offer }: { readonly offer: EarlyPaymentOffer }) {
  const percent = String(offer.percent).replace(".", ",");
  return (
    <s-banner tone="success" heading={`${percent}\u202F% de rabais si payée avant le ${shortDay(offer.deadline)}`}>
      {`À payer\u202F: ${formatChf(offer.amountCents)} au lieu de ${formatChf(offer.amountCents + offer.discountCents)}.`}
    </s-banner>
  );
}
