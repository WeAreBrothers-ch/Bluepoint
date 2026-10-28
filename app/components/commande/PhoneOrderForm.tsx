import { useMemo } from "react";
import { selectedB2b } from "../../lib/commande/form-state";
import type { PhoneOrderOutcome } from "../../lib/commande/outcome";
import type { PhoneOrderErrors } from "../../lib/commande/schema";
import { computeTotals, stockWarnings } from "../../lib/commande/totals";
import type { ProductOption } from "../../lib/commande/types";
import type { IsoDate } from "../../lib/metafields/definitions";
import { CustomerPicker } from "./CustomerPicker";
import { DeliveryFields, PaymentField } from "./DeliveryFields";
import { OrderSummary, type PriceSource } from "./OrderSummary";
import { ProductList } from "./ProductList";
import { usePhoneOrder, type Submission } from "./usePhoneOrder";

/** Formulaire de la commande par téléphone : client, bouteilles, livraison, paiement, récapitulatif. */

interface PhoneOrderFormProps {
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly paymentTermDays: number;
  readonly today: IsoDate;
  readonly outcome: PhoneOrderOutcome | undefined;
  readonly submitting: boolean;
  readonly onSubmit: (submission: Submission) => void;
}

const NO_ERRORS: PhoneOrderErrors = {};

export function PhoneOrderForm(props: PhoneOrderFormProps) {
  const order = usePhoneOrder(props.today, props.onSubmit);
  const { state, dispatch } = order;
  const errors = props.outcome?.kind === "invalide" ? props.outcome.errors : NO_ERRORS;
  const b2b = selectedB2b(state);

  const unitOverrides = useMemo(
    () => new Map(Object.entries(order.priceResult?.ok ? order.priceResult.prices.unitCents : {})),
    [order.priceResult],
  );
  const totals = useMemo(
    () => computeTotals(order.lines, props.products, b2b === null ? undefined : unitOverrides),
    [order.lines, props.products, b2b, unitOverrides],
  );
  const warnings = useMemo(() => stockWarnings(order.lines, props.products), [order.lines, props.products]);

  const priceSource: PriceSource =
    b2b === null || order.lines.length === 0
      ? "base"
      : order.priceResult === null
        ? "b2b_en_cours"
        : order.priceResult.ok
          ? "b2b"
          : "b2b_indisponible";

  return (
    <s-stack direction="block" gap="base">
      <CustomerPicker
        customer={state.customer}
        b2bLocationId={state.b2bLocationId}
        error={errors.customerId ?? errors.b2b}
        onSelect={(customer) => dispatch({ type: "client", customer })}
        onSelectB2b={(locationId) => dispatch({ type: "b2b", locationId })}
      />
      <ProductList
        products={props.products}
        truncated={props.truncated}
        quantities={state.quantities}
        onSet={order.setQuantity}
        onAdd={order.addQuantity}
      />
      <DeliveryFields
        requestedDate={state.requestedDate}
        deadline={state.deadline}
        mode={state.mode}
        note={state.note}
        today={props.today}
        errors={errors}
        onRequestedDate={(value) => dispatch({ type: "date_souhaitee", value })}
        onDeadline={(value) => dispatch({ type: "date_limite", value })}
        onMode={(mode) => dispatch({ type: "mode", mode })}
        onNote={(value) => dispatch({ type: "note", value })}
      />
      <PaymentField
        payment={state.payment}
        paymentTermDays={props.paymentTermDays}
        error={errors.payment}
        onPayment={(payment) => dispatch({ type: "paiement", payment })}
      />
      <OrderSummary
        totals={totals}
        warnings={warnings}
        priceSource={priceSource}
        linesError={errors.lines}
        canSubmit={state.customer !== null && order.lines.length > 0}
        submitting={props.submitting}
        onSubmit={order.submit}
      />
    </s-stack>
  );
}
