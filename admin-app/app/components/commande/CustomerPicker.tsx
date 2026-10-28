import type { CustomerOption } from "../../lib/commande/types";
import { CustomerSearch } from "./CustomerSearch";

/** Client de la commande : recherche, puis fiche (adresse, téléphone, entreprise B2B). */

/** Valeur du choix « au nom du client seul » dans la liste des sites B2B. */
const NO_B2B = "aucun";

interface CustomerPickerProps {
  readonly customer: CustomerOption | null;
  readonly b2bLocationId: string | null;
  readonly error: string | undefined;
  readonly onSelect: (customer: CustomerOption | null) => void;
  readonly onSelectB2b: (locationId: string | null) => void;
}

function B2bChoice({ customer, b2bLocationId, onSelectB2b }: Omit<CustomerPickerProps, "error" | "onSelect"> & { customer: CustomerOption }) {
  if (customer.b2b.length === 0) return null;
  return (
    <s-choice-list
      label="Commander pour"
      name="b2b"
      values={[b2bLocationId ?? NO_B2B]}
      onChange={(event) => {
        const value = event.currentTarget.values[0] ?? NO_B2B;
        onSelectB2b(value === NO_B2B ? null : value);
      }}
    >
      {customer.b2b.map((option) => (
        <s-choice key={option.companyLocationId} value={option.companyLocationId}>
          {`${option.companyName} — ${option.locationName} (prix du catalogue B2B)`}
        </s-choice>
      ))}
      <s-choice value={NO_B2B}>{`${customer.displayName}, sans entreprise (prix de base)`}</s-choice>
    </s-choice-list>
  );
}

function CustomerCard(props: Omit<CustomerPickerProps, "error"> & { customer: CustomerOption }) {
  const { customer, onSelect } = props;
  return (
    <s-stack direction="block" gap="base">
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack direction="block" gap="small-300">
          <s-text type="strong">{customer.displayName}</s-text>
          {customer.addressLines.length === 0 ? (
            <s-text tone="caution">Pas d’adresse par défaut : l’adresse de livraison restera vide.</s-text>
          ) : (
            customer.addressLines.map((line) => <s-text key={line}>{line}</s-text>)
          )}
          <s-text color="subdued">{customer.phone ?? "Pas de téléphone enregistré"}</s-text>
          {customer.email === null ? null : <s-text color="subdued">{customer.email}</s-text>}
        </s-stack>
      </s-box>
      <B2bChoice {...props} />
      <s-stack direction="inline">
        <s-button onClick={() => onSelect(null)}>Changer de client</s-button>
      </s-stack>
    </s-stack>
  );
}

export function CustomerPicker(props: CustomerPickerProps) {
  return (
    <s-section heading="Client">
      {props.customer === null ? (
        <CustomerSearch error={props.error} onSelect={props.onSelect} />
      ) : (
        <CustomerCard {...props} customer={props.customer} />
      )}
    </s-section>
  );
}
