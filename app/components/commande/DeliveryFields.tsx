import type { PhoneOrderErrors } from "../../lib/commande/schema";
import { PAYMENT_CHOICES, type PaymentChoice } from "../../lib/commande/types";
import { DELIVERY_MODES, isDeliveryMode, type DeliveryMode } from "../../lib/metafields/definitions";

/** Livraison (jour, mode, remarque) et façon de payer, en mots de tous les jours. */

const MODE_CHOICES: Readonly<Record<DeliveryMode, string>> = {
  livraison: "Livraison avec le camion BluePoint",
  poste: "Envoi par la Poste",
  retrait: "Le client vient chercher au dépôt",
};

function errorProps(errors: PhoneOrderErrors, field: keyof PhoneOrderErrors) {
  const error = errors[field];
  return error === undefined ? {} : { error };
}

interface DeliveryFieldsProps {
  readonly requestedDate: string;
  readonly deadline: string;
  readonly deadlineShown: boolean;
  readonly mode: DeliveryMode;
  readonly note: string;
  readonly today: string;
  readonly errors: PhoneOrderErrors;
  readonly onRequestedDate: (value: string) => void;
  readonly onDeadline: (value: string) => void;
  readonly onDeadlineShown: (shown: boolean) => void;
  readonly onMode: (mode: DeliveryMode) => void;
  readonly onNote: (value: string) => void;
}

export function DeliveryFields(props: DeliveryFieldsProps) {
  const { errors } = props;
  return (
    <s-section heading="3. Livraison">
      <s-stack direction="block" gap="base">
        <s-date-field
          label="Jour de livraison"
          value={props.requestedDate}
          allow={`${props.today}--`}
          onChange={(event) => props.onRequestedDate(event.currentTarget.value)}
          {...errorProps(errors, "requestedDate")}
        />
        <s-checkbox
          label="Le client a une date limite"
          details="À cocher seulement si la commande peut être livrée plus tard, mais pas après un certain jour."
          onChange={(event) => props.onDeadlineShown(event.currentTarget.checked)}
          {...(props.deadlineShown ? { checked: true } : {})}
        />
        {props.deadlineShown ? (
          <s-date-field
            label="À livrer au plus tard le"
            value={props.deadline}
            allow={`${props.requestedDate}--`}
            onChange={(event) => props.onDeadline(event.currentTarget.value)}
            {...errorProps(errors, "deadline")}
          />
        ) : null}
        <s-choice-list
          label="Comment la commande part-elle ?"
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
              {MODE_CHOICES[mode]}
            </s-choice>
          ))}
        </s-choice-list>
        <s-text-area
          label="Remarque pour la livraison"
          details="Le client ne la voit pas. Exemple : code de la porte, horaires, personne à demander."
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
    <s-section heading="4. Paiement">
      <s-choice-list
        label="Comment le client paie-t-il ?"
        name="payment"
        values={[payment]}
        onChange={(event) => {
          const value = event.currentTarget.values[0];
          if (isPaymentChoice(value)) onPayment(value);
        }}
        {...(error === undefined ? {} : { error })}
      >
        <s-choice value="facture">{`Sur facture (il a ${paymentTermDays} jours pour payer)`}</s-choice>
        <s-choice value="a_la_livraison">À la livraison (cash ou TWINT)</s-choice>
        <s-choice value="paye">Il a déjà payé</s-choice>
      </s-choice-list>
    </s-section>
  );
}
