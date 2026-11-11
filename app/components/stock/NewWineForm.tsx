import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { BOTTLE_SIZE_CHOICES, COUNTRY_CHOICES, EMPTY_NEW_WINE, isChampagneChoice, WINE_TYPES, type NewWineErrors, type NewWineField, type NewWineResult, type NewWineValues } from "../../lib/stock/new-wine";
import { PhotoPicker } from "./PhotoPicker";

/**
 * « Nouveau vin », en haut de la page Stock : nom, producteur, sorte, pays, contenance, prix, bouteilles en cave et photo.
 * Le pays et la contenance servent à compter les litres vendus (page « Litres vendus »).
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
  // La photo choisie reste là si une case est à corriger : pas besoin de la choisir à nouveau.
  const [photo, setPhoto] = useState<File | null>(null);
  // La sorte choisie décide si on demande le pays : le champagne vient toujours de France.
  const [type, setType] = useState(values.type);
  const champagne = isChampagneChoice(type);

  useEffect(() => {
    if (result?.ok) onCreated(result.message);
  }, [result, onCreated]);

  return (
    <s-section heading="Nouveau vin">
      <fetcher.Form
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          if (photo !== null) data.set("photo", photo, "photo.jpg");
          void fetcher.submit(data, { method: "post", encType: "multipart/form-data" });
        }}
      >
        <input type="hidden" name="intent" value="nouveau_vin" />
        <s-stack direction="block" gap="base">
          {/* Remonté à neuf après une erreur pour réafficher ce qui a été tapé. */}
          <s-query-container key={failed === undefined ? "vide" : JSON.stringify(values)}>
            <s-grid gridTemplateColumns={GRID} gap="base">
              <s-text-field label="Nom du vin" name="title" value={values.title} details="Ex. Chasselas de Lavaux 2025" {...errorProps(errors, "title")} />
              <s-text-field label="Producteur (facultatif)" name="vendor" value={values.vendor} {...errorProps(errors, "vendor")} />
              <s-select label="Sorte" name="type" value={values.type} onChange={(event) => setType(event.currentTarget.value)} {...errorProps(errors, "type")}>
                {WINE_TYPES.map((wineType) => (
                  <s-option key={wineType} value={wineType}>
                    {wineType}
                  </s-option>
                ))}
              </s-select>
              {champagne ? (
                <s-text-field label="Pays" name="country" value="France" readOnly details="Le champagne vient toujours de France." />
              ) : (
                <s-select label="Pays" name="country" value={values.country} {...errorProps(errors, "country")}>
                  <s-option value="">Choisir le pays…</s-option>
                  {COUNTRY_CHOICES.map((country) => (
                    <s-option key={country} value={country}>
                      {country}
                    </s-option>
                  ))}
                </s-select>
              )}
              <s-select label="Contenance d’une bouteille" name="size" value={values.size} details="Sert à compter les litres vendus" {...errorProps(errors, "size")}>
                {BOTTLE_SIZE_CHOICES.map((size) => (
                  <s-option key={size.value} value={size.value}>
                    {size.label}
                  </s-option>
                ))}
              </s-select>
              <s-text-field label="Année (facultatif)" name="vintage" value={values.vintage} details="Ex. 2022" {...errorProps(errors, "vintage")} />
              <s-text-field label="Appellation (facultatif)" name="appellation" value={values.appellation} details="Ex. Dézaley AOC, Barolo DOCG" {...errorProps(errors, "appellation")} />
              <s-text-field label="Région (facultatif)" name="region" value={values.region} details="Ex. Piémont, Lavaux" {...errorProps(errors, "region")} />
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
          <PhotoPicker photo={photo} onChange={setPhoto} disabled={busy} />
          {failed === undefined ? null : <s-banner tone="critical" heading={failed.message} />}
          <s-stack direction="inline" gap="small-200">
            <s-button type="submit" variant="primary" icon="check" {...(busy ? { loading: true } : {})}>
              Créer le vin
            </s-button>
            <s-button onClick={onCancel} {...(busy ? { disabled: true } : {})}>
              Annuler
            </s-button>
          </s-stack>
        </s-stack>
      </fetcher.Form>
    </s-section>
  );
}
