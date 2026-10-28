import { useState } from "react";
import { useFetcher } from "react-router";
import { EMPTY_PRO_REQUEST, PRO_COUNTRIES, type ProRequestErrors, type ProRequestField, type ProRequestValues } from "../../lib/pros/request";
import type { ProsActionResult } from "../../lib/pros/view";

/** « Ajouter un client pro » : pour un pro qui appelle, son compte est créé tout de suite, sans passer par le site. */

const GRID = "@container (inline-size > 520px) 1fr 1fr, 1fr";

interface FieldProps {
  readonly field: ProRequestField;
  readonly label: string;
  readonly values: ProRequestValues;
  readonly errors: ProRequestErrors;
  readonly details?: string;
}

function Field({ field, label, values, errors, details }: FieldProps) {
  const error = errors[field];
  return (
    <s-text-field
      label={label}
      name={field}
      value={values[field]}
      {...(details === undefined ? {} : { details })}
      {...(error === undefined ? {} : { error })}
    />
  );
}

function Fields({ values, errors }: { readonly values: ProRequestValues; readonly errors: ProRequestErrors }) {
  const props = { values, errors };
  return (
    <s-stack direction="block" gap="base">
      <Field {...props} field="companyName" label="Nom de l’entreprise" details="Ex. Restaurant du Lac" />
      <s-query-container>
        <s-grid gridTemplateColumns={GRID} gap="base">
          <Field {...props} field="firstName" label="Prénom" />
          <Field {...props} field="lastName" label="Nom" />
          <Field {...props} field="email" label="E-mail" details="Il servira à se connecter au site." />
          <Field {...props} field="phone" label="Téléphone" details="Ex. 079 123 45 67" />
          <Field {...props} field="street" label="Rue et numéro" />
          <Field {...props} field="postalCode" label="NPA" />
          <Field {...props} field="city" label="Localité" />
          <s-select label="Pays" name="country" value={values.country}>
            {PRO_COUNTRIES.map((country) => (
              <s-option key={country.code} value={country.code}>
                {country.label}
              </s-option>
            ))}
          </s-select>
        </s-grid>
      </s-query-container>
      <Field {...props} field="vatNumber" label="Numéro TVA (facultatif)" details="Ex. CHE-123.456.789 TVA" />
    </s-stack>
  );
}

/** Formulaire fermé. Ouvert, on retient la réponse affichée à l'ouverture : une nouvelle réussite le referme. */
const CLOSED = Symbol("fermé");
const NO_RESPONSE = Symbol("aucune réponse");

export function AddProForm({ canCreate }: { readonly canCreate: boolean }) {
  const fetcher = useFetcher<ProsActionResult>({ key: "pro-ajouter" });
  const [openedWith, setOpenedWith] = useState<ProsActionResult | symbol>(CLOSED);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" && fetcher.data?.intent === "ajouter" ? fetcher.data : undefined;
  // Client pro créé : le formulaire se referme et le message de réussite s'affiche à sa place.
  const open = openedWith !== CLOSED && !(result?.ok === true && result !== openedWith);
  const setOpen = (next: boolean) => setOpenedWith(next ? (fetcher.data ?? NO_RESPONSE) : CLOSED);
  const errors = result !== undefined && !result.ok ? (result.errors ?? {}) : {};
  const values = result !== undefined && !result.ok ? (result.values ?? EMPTY_PRO_REQUEST) : EMPTY_PRO_REQUEST;

  if (!open) {
    return (
      <s-stack direction="block" gap="base">
        {result?.ok ? <s-banner tone="success" heading={result.message} /> : null}
        <s-stack direction="inline">
          <s-button icon="person-add" onClick={() => setOpen(true)} {...(canCreate ? {} : { disabled: true })}>
            Ajouter un client pro
          </s-button>
        </s-stack>
      </s-stack>
    );
  }

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="ajouter" />
      <s-stack direction="block" gap="base">
        {/* Remonté à neuf après une erreur pour réafficher les valeurs tapées. */}
        <Fields key={result === undefined ? "vide" : JSON.stringify(values)} values={values} errors={errors} />
        {result !== undefined && !result.ok ? <s-banner tone="critical" heading={result.message} /> : null}
        <s-stack direction="inline" gap="small-200">
          <s-button type="submit" variant="primary" icon="check" {...(busy ? { loading: true } : {})}>
            Créer le client pro
          </s-button>
          <s-button onClick={() => setOpen(false)} {...(busy ? { disabled: true } : {})}>
            Annuler
          </s-button>
        </s-stack>
        <s-text color="subdued">
          L’entreprise est créée dans Shopify avec le paiement à 30 jours et les prix pros ; la personne reçoit un e-mail pour se connecter.
        </s-text>
      </s-stack>
    </fetcher.Form>
  );
}
