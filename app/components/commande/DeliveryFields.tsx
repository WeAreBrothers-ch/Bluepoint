import { useState } from "react";
import { capitalize, longDay } from "../../lib/agenda/dates";
import type { PhoneOrderErrors } from "../../lib/commande/schema";
import { PAYMENT_CHOICES, type PaymentChoice } from "../../lib/commande/types";
import { DELIVERY_MODES, isDeliveryMode, parseIsoDate, type DeliveryMode } from "../../lib/metafields/definitions";
import { FILL } from "../fill";

/**
 * Livraison (jour, mode, remarque) et façon de payer, en mots de tous les jours.
 * Tout est déjà rempli (prochain jour de livraison, camion BluePoint, paiement habituel du client) :
 * on voit un résumé en deux lignes et « Modifier » ouvre les cases. Une erreur les ouvre d'office.
 */

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

function DeliveryFields(props: DeliveryFieldsProps) {
  const { errors } = props;
  return (
    <>
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
        label={"Comment la commande part-elle\u202F?"}
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
    </>
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

function PaymentField({ payment, paymentTermDays, error, onPayment }: PaymentFieldProps) {
  return (
    <s-choice-list
      label={"Comment le client paie-t-il\u202F?"}
      name="payment"
      values={[payment]}
      onChange={(event) => {
        const value = event.currentTarget.values[0];
        if (isPaymentChoice(value)) onPayment(value);
      }}
      {...(error === undefined ? {} : { error })}
    >
      <s-choice value="facture">{`Sur facture (il a ${paymentTermDays} jours pour payer)`}</s-choice>
      <s-choice value="a_la_livraison">À la livraison (espèces ou TWINT)</s-choice>
      <s-choice value="paye">Il a déjà payé</s-choice>
    </s-choice-list>
  );
}

const MODE_SHORT: Readonly<Record<DeliveryMode, string>> = {
  livraison: "camion BluePoint",
  poste: "envoi par la Poste",
  retrait: "le client vient au dépôt",
};

function paymentSummary(payment: PaymentChoice, paymentTermDays: number): string {
  if (payment === "facture") return `sur facture (${paymentTermDays} jours)`;
  if (payment === "a_la_livraison") return "à la livraison (espèces ou TWINT)";
  return "déjà payé";
}

type DeliveryAndPaymentProps = DeliveryFieldsProps & PaymentFieldProps;

/** « 3. Livraison et paiement » : le résumé, ou les cases quand on veut changer quelque chose. */
export function DeliveryAndPayment(props: DeliveryAndPaymentProps) {
  const [editing, setEditing] = useState(false);
  const hasError =
    props.error !== undefined || (["requestedDate", "deadline", "mode", "note"] as const).some((field) => props.errors[field] !== undefined);
  const open = editing || hasError;
  const date = parseIsoDate(props.requestedDate);
  const day = date === null ? "Jour à choisir" : capitalize(longDay(date));
  const deadline = props.deadlineShown ? parseIsoDate(props.deadline) : null;
  return (
    <s-section heading="3. Livraison et paiement">
      {open ? (
        <s-stack direction="block" gap="base">
          <DeliveryFields {...props} />
          <PaymentField payment={props.payment} paymentTermDays={props.paymentTermDays} error={props.error} onPayment={props.onPayment} />
          <s-grid gridTemplateColumns="minmax(0, 1fr)">
            <s-button {...FILL} icon="check" onClick={() => setEditing(false)}>
              C’est bon
            </s-button>
          </s-grid>
        </s-stack>
      ) : (
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{`${day} · ${MODE_SHORT[props.mode]}`}</s-text>
          {deadline === null ? null : <s-text>{`Au plus tard le ${longDay(deadline)}`}</s-text>}
          <s-text>{`Paiement\u202F: ${paymentSummary(props.payment, props.paymentTermDays)}`}</s-text>
          {props.note.trim() === "" ? null : <s-text color="subdued">{`Remarque\u202F: ${props.note.trim()}`}</s-text>}
          <s-grid gridTemplateColumns="minmax(0, 1fr)">
            <s-button {...FILL} icon="edit" onClick={() => setEditing(true)}>
              Modifier
            </s-button>
          </s-grid>
        </s-stack>
      )}
    </s-section>
  );
}
