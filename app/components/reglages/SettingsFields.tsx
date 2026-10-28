import type { SettingsFormValues } from "../../lib/reglages/form-values";
import type { SettingsField, SettingsFieldErrors } from "../../lib/reglages/schema";

/** Champs des réglages, en mots simples et groupés par thème. Tout ce qui est ici est imprimé sur les factures. */

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
    <s-section heading="1. Votre entreprise">
      <s-stack direction="block" gap="base">
        <s-paragraph color="subdued">Ces informations sont imprimées en haut de chaque facture.</s-paragraph>
        <Text {...props} field="legalName" label="Nom de l’entreprise" details="Ex. Blue Point Distribution Sàrl" />
        <s-query-container>
          <s-grid gridTemplateColumns={GRID} gap="base">
            <Text {...props} field="street" label="Rue" details="Sans le numéro" />
            <Text {...props} field="buildingNumber" label="Numéro de rue" />
            <Text {...props} field="postalCode" label="NPA" details="4 chiffres, ex. 1095" />
            <Text {...props} field="city" label="Localité" />
          </s-grid>
        </s-query-container>
        <s-select label="Pays" name="country" value={props.values.country} {...errorProps(props.errors, "country")}>
          <s-option value="CH">Suisse</s-option>
          <s-option value="LI">Liechtenstein</s-option>
        </s-select>
        <Text {...props} field="vatNumber" label="Numéro TVA" details="Ex. CHE-123.456.789 TVA" />
        <s-query-container>
          <s-grid gridTemplateColumns={GRID} gap="base">
            <s-email-field
              label="E-mail"
              name="email"
              value={props.values.email}
              details="Les clients vous répondent à cette adresse."
              {...errorProps(props.errors, "email")}
            />
            <Text {...props} field="phone" label="Téléphone" />
          </s-grid>
        </s-query-container>
      </s-stack>
    </s-section>
  );
}

export function PaymentFields(props: FieldsProps) {
  return (
    <s-section heading="2. Votre compte en banque">
      <s-stack direction="block" gap="base">
        <s-paragraph color="subdued">Le QR code de chaque facture envoie l’argent sur ce compte.</s-paragraph>
        <Text {...props} field="iban" label="IBAN" details="Il commence par CH et se trouve sur vos relevés de banque." />
        <Text
          {...props}
          field="qrIban"
          label="QR-IBAN (seulement si votre banque vous en a donné un)"
          details="Sinon, laissez cette case vide."
        />
        <s-number-field
          label={"Combien de jours les clients ont-ils pour payer\u202F?"}
          details="En général 30 jours."
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
    <s-section heading="3. Ce qui se fait tout seul">
      <s-stack direction="block" gap="base">
        <s-checkbox
          name="autoInvoiceOnDelivery"
          value="on"
          label="Faire la facture aussi quand une commande est expédiée directement dans Shopify"
          details="« J’ai livré la commande » dans l’agenda fait toujours la facture, que cette case soit cochée ou non."
          {...(values.autoInvoiceOnDelivery ? { checked: true } : {})}
        />
        <s-checkbox
          name="notifyCustomerOnDelivery"
          value="on"
          label="Prévenir le client par e-mail quand sa commande est livrée"
          details="C’est l’e-mail automatique de Shopify, envoyé quand vous touchez « J’ai livré la commande »."
          {...(values.notifyCustomerOnDelivery ? { checked: true } : {})}
        />
      </s-stack>
    </s-section>
  );
}
