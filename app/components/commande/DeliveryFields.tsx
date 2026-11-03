import type { PhoneOrderErrors } from "../../lib/commande/schema";
import { PAYMENT_CHOICES, type PaymentChoice } from "../../lib/commande/types";
import { DELIVERY_MODES, DELIVERY_MODE_LABELS, isDeliveryMode, type DeliveryMode } from "../../lib/metafields/definitions";

/** Livraison (dates, mode, remarque interne) et mode de paiement. */

const GRID = "@container (inline-size > 520px) 1fr 1fr, 1fr";

function errorProps(errors: PhoneOrderErrors, field: keyof PhoneOrderErrors) {
  const error = errors[field];
  return error === undefined ? {} : { error };
}

interface DeliveryFieldsProps {
  readonly requestedDate: string;
  readonly deadline: string;
  readonly mode: DeliveryMode;
  readonly note: string;
  readonly today: string;
  readonly errors: PhoneOrderErrors;
  readonly onRequestedDate: (value: string) => void;
  readonly onDeadline: (value: string) => void;
  readonly onMode: (mode: DeliveryMode) => void;
  readonly onNote: (value: string) => void;
}

export function DeliveryFields(props: DeliveryFieldsProps) {
  const { errors } = props;
  return (
    <s-section heading="3. Quand et comment livrer ?">
      <s-stack direction="block" gap="base">
        <s-query-container>
          <s-grid gridTemplateColumns={GRID} gap="base">
            <s-date-field
              label="Livrer le"
              value={props.requestedDate}
              allow={`${props.today}--`}
              onChange={(event) => props.onRequestedDate(event.currentTarget.value)}
              {...errorProps(errors, "requestedDate")}
            />
            <s-date-field
              label="Au plus tard le"
              details="Facultatif. Par défaut, la même date."
              value={props.deadline}
              allow={`${props.requestedDate}--`}
              onChange={(event) => props.onDeadline(event.currentTarget.value)}
              {...errorProps(errors, "deadline")}
            />
          </s-grid>
        </s-query-container>
        <s-choice-list
          label="Comment ?"
          name="mode"
          values={[props.mode]}
          onChange={(event) => {
            const value = event.currentTarget.values[0];
            if (isDeliveryMode(value)) props.onMode(value);
          }}
          {...errorProps(errors, "mode")}
        >
          {DELIVERY_MODES.map((mode) => (
            <s-choice key={mode} value={mode}>
              {DELIVERY_MODE_LABELS[mode]}
            </s-choice>
          ))}
        </s-choice-list>
        <s-text-area
          label="Note pour la livraison (facultatif)"
          details="Vous seul la voyez : code d’accès, horaires, personne à contacter…"
          value={props.note}
          rows={3}
          maxLength={5000}
          onInput={(event) => props.onNote(event.currentTarget.value)}
          {...errorProps(errors, "note")}
        />
      </s-stack>
    </s-section>
  );
}

interface PaymentFieldProps {
  readonly payment: PaymentChoice;
  readonly paymentTermDays: number;
  readonly error: string | undefined;
  readonly onPayment: (payment: PaymentChoice) => void;
}

function isPaymentChoice(value: unknown): value is PaymentChoice {
  return typeof value === "string" && (PAYMENT_CHOICES as readonly string[]).includes(value);
}

export function PaymentField({ payment, paymentTermDays, error, onPayment }: PaymentFieldProps) {
  return (
    <s-section heading="4. Comment le client paie-t-il ?">
      <s-choice-list
        label="Paiement"
        labelAccessibilityVisibility="exclusive"
        name="payment"
        values={[payment]}
        onChange={(event) => {
          const value = event.currentTarget.values[0];
          if (isPaymentChoice(value)) onPayment(value);
        }}
        {...(error === undefined ? {} : { error })}
      >
        <s-choice value="bon_de_commande">
          {`Plus tard, sur facture (à payer sous ${paymentTermDays} jours)`}
        </s-choice>
        <s-choice value="paye">Déjà payé, ou payé à la livraison</s-choice>
      </s-choice-list>
    </s-section>
  );
}
