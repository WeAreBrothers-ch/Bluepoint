import type { NewCustomerErrors, NewCustomerField, NewCustomerValues } from "../../lib/commande/new-customer";

/** Les cases d'une fiche client, les mêmes pour « Nouveau client » et « Modifier les coordonnées ». */

const GRID = "@container (inline-size > 520px) 1fr 1fr, 1fr";

interface CustomerFieldsProps {
  readonly values: NewCustomerValues;
  readonly errors: NewCustomerErrors;
}

function Field(props: CustomerFieldsProps & { readonly field: NewCustomerField; readonly label: string; readonly details?: string }) {
  const error = props.errors[props.field];
  return (
    <s-text-field
      label={props.label}
      name={props.field}
      value={props.values[props.field]}
      {...(props.details === undefined ? {} : { details: props.details })}
      {...(error === undefined ? {} : { error })}
    />
  );
}

export function CustomerFields({ values, errors }: CustomerFieldsProps) {
  return (
    <>
      <s-query-container>
        <s-grid gridTemplateColumns={GRID} gap="base">
          <Field field="firstName" label="Prénom" values={values} errors={errors} />
          <Field field="lastName" label="Nom" values={values} errors={errors} />
          <Field field="company" label="Entreprise (facultatif)" values={values} errors={errors} />
          <Field field="phone" label="Téléphone" details="Ex. 079 123 45 67" values={values} errors={errors} />
          <Field field="email" label="E-mail (facultatif)" values={values} errors={errors} />
        </s-grid>
      </s-query-container>
      <s-text color="subdued">Adresse de livraison (inutile si le client vient chercher au dépôt)</s-text>
      <s-query-container>
        <s-grid gridTemplateColumns={GRID} gap="base">
          <Field field="street" label="Rue et numéro" values={values} errors={errors} />
          <Field field="postalCode" label="NPA" values={values} errors={errors} />
          <Field field="city" label="Localité" values={values} errors={errors} />
        </s-grid>
      </s-query-container>
    </>
  );
}
