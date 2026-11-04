import { useEffect } from "react";
import { useFetcher } from "react-router";
import type { NewCustomerValues } from "../../lib/commande/new-customer";
import type { CustomerOption } from "../../lib/commande/types";
import type { NewCustomerResult } from "../../routes/app.nouveau-client";
import { CustomerFields } from "./CustomerFields";

/**
 * Fiche d'un nouveau client, créée sans quitter « Prendre une commande ».
 * Une fois créée, le client est choisi tout de suite pour la commande.
 */

interface NewCustomerFormProps {
  readonly initial: NewCustomerValues;
  readonly onCreated: (customer: CustomerOption) => void;
  readonly onCancel: () => void;
}

export function NewCustomerForm({ initial, onCreated, onCancel }: NewCustomerFormProps) {
  // Sans clé : rouvrir le formulaire repart de zéro (une ancienne réussite ne rechoisit pas l'ancien client).
  const fetcher = useFetcher<NewCustomerResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const failed = result !== undefined && !result.ok ? result : undefined;
  const values = failed?.values ?? initial;
  const errors = failed?.errors ?? {};

  useEffect(() => {
    if (result?.ok) onCreated(result.customer);
  }, [result, onCreated]);

  return (
    <s-box padding="base" border="base" borderRadius="base" background="subdued">
      <fetcher.Form method="post" action="/app/nouveau-client">
        <s-stack direction="block" gap="base">
          <s-heading>Nouveau client</s-heading>
          {/* Remonté à neuf après une erreur pour réafficher ce qui a été tapé. */}
          <s-stack key={failed === undefined ? "vide" : JSON.stringify(values)} direction="block" gap="base">
            <CustomerFields values={values} errors={errors} />
          </s-stack>
          {failed === undefined ? null : <s-banner tone="critical" heading={failed.message} />}
          <s-stack direction="inline" gap="small-200">
            <s-button type="submit" variant="primary" icon="check" {...(busy ? { loading: true } : {})}>
              Créer le client et continuer
            </s-button>
            <s-button onClick={onCancel} {...(busy ? { disabled: true } : {})}>
              Annuler
            </s-button>
          </s-stack>
        </s-stack>
      </fetcher.Form>
    </s-box>
  );
}
