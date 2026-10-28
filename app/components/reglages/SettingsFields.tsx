import type { SettingsFormValues } from "../../lib/reglages/form-values";
import type { SettingsField, SettingsFieldErrors } from "../../lib/reglages/schema";

/** Champs du formulaire des réglages, groupés par thème. */

interface FieldsProps {
  readonly values: SettingsFormValues;
  readonly errors: SettingsFieldErrors;
}

type TextKey = Exclude<SettingsField, "autoInvoiceOnDelivery" | "notifyCustomerOnDelivery">;

const GRID = "@container (inline-size > 520px) 1fr 1fr, 1fr";

function errorProps(errors: SettingsFieldErrors, field: SettingsField) {
  const error = errors[field];
  return error === undefined ? {} : { error };
}

function Text({ field, label, values, errors, details }: FieldsProps & { field: TextKey; label: string; details?: string }) {
  return (
    <s-text-field
      label={label}
      name={field}
      value={values[field]}
      {...(details === undefined ? {} : { details })}
      {...errorProps(errors, field)}
    />
  );
}

export function SellerFields(props: FieldsProps) {
  return (
    <s-section heading="Vendeur">
      <s-stack direction="block" gap="base">
        <Text {...props} field="legalName" label="Raison sociale" />
        <s-query-container>
          <s-grid gridTemplateColumns={GRID} gap="base">
            <Text {...props} field="street" label="Rue" />
            <Text {...props} field="buildingNumber" label="Numéro" />
            <Text {...props} field="postalCode" label="NPA" />
            <Text {...props} field="city" label="Localité" />
          </s-grid>
        </s-query-container>
        <Text {...props} field="country" label="Pays" details="CH ou LI" />
        <Text {...props} field="vatNumber" label="Numéro TVA" details="Format CHE-123.456.789 TVA" />
        <s-query-container>
          <s-grid gridTemplateColumns={GRID} gap="base">
            <s-email-field label="E-mail" name="email" value={props.values.email} {...errorProps(props.errors, "email")} />
            <Text {...props} field="phone" label="Téléphone" />
          </s-grid>
        </s-query-container>
      </s-stack>
    </s-section>
  );
}

export function PaymentFields(props: FieldsProps) {
  return (
    <s-section heading="Paiement">
      <s-stack direction="block" gap="base">
        <Text {...props} field="iban" label="IBAN" details="Compte suisse (CH) ou liechtensteinois (LI)" />
        <Text {...props} field="qrIban" label="QR-IBAN (facultatif)" details="Avec un QR-IBAN, la facture porte une référence QR à 27 chiffres." />
        <s-number-field
          label="Délai de paiement (jours)"
          name="paymentTermDays"
          value={props.values.paymentTermDays}
          min={0}
          max={120}
          step={1}
          {...errorProps(props.errors, "paymentTermDays")}
        />
      </s-stack>
    </s-section>
  );
}

export function AutomationFields({ values }: Pick<FieldsProps, "values">) {
  return (
    <s-section heading="Automatismes">
      <s-stack direction="block" gap="base">
        <s-checkbox
          name="autoInvoiceOnDelivery"
          value="on"
          label="Créer la facture dès qu’une expédition est créée dans Shopify"
          details="Aussi pour les expéditions faites hors de l’app. « Marquer livrée » crée toujours la facture."
          {...(values.autoInvoiceOnDelivery ? { checked: true } : {})}
        />
        <s-checkbox
          name="notifyCustomerOnDelivery"
          value="on"
          label="Envoyer au client l’e-mail d’expédition de Shopify quand l’app marque une commande livrée"
          {...(values.notifyCustomerOnDelivery ? { checked: true } : {})}
        />
      </s-stack>
    </s-section>
  );
}
