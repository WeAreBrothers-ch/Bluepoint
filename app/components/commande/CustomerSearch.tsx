import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { MIN_SEARCH_LENGTH } from "../../lib/commande/customers";
import type { CustomerOption } from "../../lib/commande/types";
import type { CustomerSearchResult } from "../../routes/app.recherche-clients";
import { useDebouncedValue } from "../useDebouncedValue";
import { TouchButton } from "./TouchButton";

/** Recherche d'un client (nom, entreprise, téléphone, e-mail), lancée 300 ms après la frappe. */

/** Fiche client vierge dans l'admin Shopify, pour un client qui n'existe pas encore. */
const NEW_CUSTOMER_URL = "shopify://admin/customers/new";

const SEARCH_DELAY_MS = 300;

interface CustomerSearchProps {
  readonly error: string | undefined;
  readonly onSelect: (customer: CustomerOption) => void;
}

function summary(customer: CustomerOption): string {
  const company = customer.b2b[0]?.companyName ?? customer.address?.company ?? null;
  return [company, customer.phone, customer.email].filter((part) => part !== null && part !== "").join(" · ");
}

export function CustomerSearch({ error, onSelect }: CustomerSearchProps) {
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), SEARCH_DELAY_MS);
  const fetcher = useFetcher<CustomerSearchResult>();
  const { load } = fetcher;

  useEffect(() => {
    if (debounced.length >= MIN_SEARCH_LENGTH) load(`/app/recherche-clients?q=${encodeURIComponent(debounced)}`);
  }, [debounced, load]);

  const searching = fetcher.state !== "idle";
  const data = debounced.length >= MIN_SEARCH_LENGTH ? fetcher.data : undefined;

  return (
    <s-stack direction="block" gap="small-200">
      <s-search-field
        label="Qui commande ?"
        placeholder="Nom, entreprise ou numéro de téléphone"
        value={term}
        onInput={(event) => setTerm(event.currentTarget.value)}
        {...(error === undefined ? {} : { error })}
      />
      {term.trim().length > 0 && term.trim().length < MIN_SEARCH_LENGTH ? (
        <s-text color="subdued">Tapez au moins 2 lettres ou chiffres.</s-text>
      ) : null}
      {searching ? <s-text color="subdued">Recherche…</s-text> : null}
      {data?.error ? <s-banner tone="critical" heading={data.error} /> : null}
      {data !== undefined && data.error === null && data.customers.length === 0 && !searching ? (
        <s-stack direction="block" gap="small-200">
          <s-text>Aucun client trouvé. Essayez son numéro de téléphone ou le nom de son entreprise.</s-text>
          <s-text color="subdued">Si c’est un nouveau client, créez sa fiche dans Shopify, puis revenez ici.</s-text>
          <s-stack direction="inline">
            <s-button href={NEW_CUSTOMER_URL} icon="person-add">
              Créer un nouveau client
            </s-button>
          </s-stack>
        </s-stack>
      ) : null}
      {data?.customers.map((customer) => (
        <TouchButton key={customer.id} label={`Choisir ${customer.displayName}`} onPress={() => onSelect(customer)} fill>
          <s-stack direction="block" gap="none">
            <s-text type="strong">{customer.isPro ? `${customer.displayName} · client pro` : customer.displayName}</s-text>
            <s-text color="subdued">{summary(customer)}</s-text>
          </s-stack>
        </TouchButton>
      ))}
    </s-stack>
  );
}
