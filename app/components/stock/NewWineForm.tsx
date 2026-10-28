import { useEffect } from "react";
import { useFetcher } from "react-router";
import { EMPTY_NEW_WINE, WINE_TYPES, type NewWineErrors, type NewWineField, type NewWineResult, type NewWineValues } from "../../lib/stock/new-wine";

/**
 * « Nouveau vin », en haut de la page Stock : nom, producteur, sorte, prix et bouteilles en cave.
 * Une fois créé, le vin apparaît dans la liste, sur le site et dans « Prendre une commande ».
 */

const GRID = "@container (inline-size > 520px) 1fr 1fr, 1fr";

interface NewWineFormProps {
  readonly onCreated: (message: string) => void;
  readonly onCancel: () => void;
}

function errorProps(errors: NewWineErrors, field: NewWineField) {
  const error = errors[field];
  return error === undefined ? {} : { error };
}

export function NewWineForm({ onCreated, onCancel }: NewWineFormProps) {
  // Sans clé : rouvrir le formulaire repart de zéro.
  const fetcher = useFetcher<NewWineResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const failed = result !== undefined && !result.ok ? result : undefined;
  const values: NewWineValues = failed?.values ?? EMPTY_NEW_WINE;
  const errors = failed?.errors ?? {};

  useEffect(() => {
    if (result?.ok) onCreated(result.message);
  }, [result, onCreated]);

  return (
    <s-section heading="Nouveau vin">
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="nouveau_vin" />
        <s-stack direction="block" gap="base">
          {/* Remonté à neuf après une erreur pour réafficher ce qui a été tapé. */}
          <s-query-container key={failed === undefined ? "vide" : JSON.stringify(values)}>
            <s-grid gridTemplateColumns={GRID} gap="base">
              <s-text-field label="Nom du vin" name="title" value={values.title} details="Ex. Chasselas de Lavaux 2025" {...errorProps(errors, "title")} />
              <s-text-field label="Producteur (facultatif)" name="vendor" value={values.vendor} {...errorProps(errors, "vendor")} />
              <s-select label="Sorte" name="type" value={values.type} {...errorProps(errors, "type")}>
                {WINE_TYPES.map((type) => (
                  <s-option key={type} value={type}>
                    {type}
                  </s-option>
                ))}
              </s-select>
              <s-text-field label="Prix d’une bouteille (CHF)" name="price" value={values.price} details="Ex. 25.50" {...errorProps(errors, "price")} />
              <s-number-field
                label="Bouteilles en cave"
                name="quantity"
                value={values.quantity}
                min={0}
                step={1}
                inputMode="numeric"
                details="0 si le vin n’est pas encore arrivé"
                {...errorProps(errors, "quantity")}
              />
            </s-grid>
          </s-query-container>
          {failed === undefined ? null : <s-banner tone="critical" heading={failed.message} />}
          <s-stack direction="inline" gap="small-200">
            <s-button type="submit" variant="primary" icon="check" {...(busy ? { loading: true } : {})}>
              Créer le vin
            </s-button>
            <s-button onClick={onCancel} {...(busy ? { disabled: true } : {})}>
              Annuler
            </s-button>
          </s-stack>
          <s-text color="subdued">La photo et la description pourront être ajoutées plus tard.</s-text>
        </s-stack>
      </fetcher.Form>
    </s-section>
  );
}
