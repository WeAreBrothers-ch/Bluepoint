import { useMemo } from "react";
import type { PhoneOrderOutcome } from "../../lib/commande/outcome";
import type { PhoneOrderErrors } from "../../lib/commande/schema";
import { computeTotals, stockWarnings } from "../../lib/commande/totals";
import type { ProductOption } from "../../lib/commande/types";
import type { IsoDate } from "../../lib/metafields/definitions";
import { CustomerPicker } from "./CustomerPicker";
import { DeliveryFields, PaymentField } from "./DeliveryFields";
import { OrderOutcomeBanner } from "./OrderOutcomeBanner";
import { OrderSummary, type PriceSource } from "./OrderSummary";
import { ProductList } from "./ProductList";
import { usePhoneOrder, type Submission } from "./usePhoneOrder";

/** Prendre une commande, dans l'ordre d'un appel : client, vins, livraison, paiement, récapitulatif. */

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
  const prices = order.priceResult?.ok ? order.priceResult.prices : null;

  const unitOverrides = useMemo(() => new Map(Object.entries(prices?.unitCents ?? {})), [prices]);
  const totals = useMemo(
    () => computeTotals(order.lines, props.products, unitOverrides),
    [order.lines, props.products, unitOverrides],
  );
  const warnings = useMemo(() => stockWarnings(order.lines, props.products), [order.lines, props.products]);
  // Remise sur la commande (ex. « Prix pro -15 % ») : écart entre les lignes et le sous-total calculé par Shopify.
  const discountCents = prices === null ? 0 : Math.max(0, totals.subtotalCents - prices.subtotalCents);

  const priceSource: PriceSource =
    state.customer === null || order.lines.length === 0
      ? "normal"
      : order.priceResult === null
        ? "calcul"
        : order.priceResult.ok
          ? "client"
          : "indisponible";

  const missing =
    state.customer === null
      ? "Choisissez d’abord le client (étape 1)."
      : order.lines.length === 0
        ? "Ajoutez au moins un vin (étape 2)."
        : null;

  return (
    <s-stack direction="block" gap="base">
      <CustomerPicker
        customer={state.customer}
        b2bLocationId={state.b2bLocationId}
        products={props.products}
        error={errors.customerId ?? errors.b2b}
        onSelect={(customer) => dispatch({ type: "client", customer })}
        onSelectB2b={(locationId) => dispatch({ type: "b2b", locationId })}
        onRepeat={(lines) => dispatch({ type: "reprendre", lines })}
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
        deadlineShown={state.deadlineShown || errors.deadline !== undefined}
        mode={state.mode}
        note={state.note}
        today={props.today}
        errors={errors}
        onRequestedDate={(value) => dispatch({ type: "date_souhaitee", value })}
        onDeadline={(value) => dispatch({ type: "date_limite", value })}
        onDeadlineShown={(shown) => dispatch({ type: "limite_visible", shown })}
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
        discountCents={discountCents}
        warnings={warnings}
        priceSource={priceSource}
        linesError={errors.lines}
        missing={missing}
        submitting={props.submitting}
        onSubmit={order.submit}
        outcome={props.outcome === undefined ? null : <OrderOutcomeBanner outcome={props.outcome} />}
      />
    </s-stack>
  );
}
