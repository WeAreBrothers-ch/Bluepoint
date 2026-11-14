import { useRef, useState } from "react";
import { WINE_COUNTRIES } from "../../lib/litres/wine-info";
import {
  FICHE_SIZE_CHOICES,
  FICHE_TYPES,
  retitle,
  type FicheErrors,
  type FicheField,
  type FicheLoadResult,
  type FicheValues,
} from "../../lib/stock/fiche";
import { FILL } from "../fill";

/**
 * « Modifier la fiche » d'un vin de la page Stock : tout ce que le site affiche du vin, sauf le prix, la photo
 * et le stock (qui ont leurs propres boutons). Marche pour tous les vins, y compris ceux créés avant l'app.
 */

const OTHER_REGION = "__autre__";

interface FichePanelProps {
  /** La fiche lue dans Shopify (`undefined` pendant la lecture). */
  readonly loaded: FicheLoadResult | undefined;
  readonly saving: boolean;
  /** Le refus de Shopify ou les cases à corriger, après « Enregistrer la fiche ». */
  readonly failure: { readonly message: string; readonly errors: FicheErrors } | undefined;
  readonly onSubmit: (values: FicheValues) => void;
  readonly onCancel: () => void;
}

function errorProps(errors: FicheErrors, field: FicheField) {
  const error = errors[field];
  return error === undefined ? {} : { error };
}

export function FichePanel({ loaded, saving, failure, onSubmit, onCancel }: FichePanelProps) {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      {loaded === undefined ? (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-spinner accessibilityLabel="Lecture de la fiche" size="base" />
          <s-text>Lecture de la fiche…</s-text>
        </s-stack>
      ) : !loaded.ok ? (
        <s-stack direction="block" gap="small-200">
          <s-banner tone="critical" heading={loaded.message} />
          <s-button icon="x" onClick={onCancel}>
            Fermer
          </s-button>
        </s-stack>
      ) : (
        <FicheForm initial={loaded.values} regions={loaded.regions} saving={saving} failure={failure} onSubmit={onSubmit} onCancel={onCancel} />
      )}
    </s-box>
  );
}

interface FicheFormProps {
  readonly initial: FicheValues;
  readonly regions: readonly string[];
  readonly saving: boolean;
  readonly failure: FichePanelProps["failure"];
  readonly onSubmit: (values: FicheValues) => void;
  readonly onCancel: () => void;
}

function FicheForm({ initial, regions, saving, failure, onSubmit, onCancel }: FicheFormProps) {
  const [values, setValues] = useState<FicheValues>(initial);
  // L'année écrite dans le nom : quand on tape une nouvelle année, le nom suit (« Peng 2022 » → « Peng 2023 »).
  const titleVintage = useRef(initial.vintage);
  // Une région qui n'est pas encore dans le menu du site : on l'écrit à la main.
  const [typingRegion, setTypingRegion] = useState(initial.region !== "" && !regions.includes(initial.region));
  const errors = failure?.errors ?? {};
  const set = (field: FicheField, value: string) => setValues((current) => ({ ...current, [field]: value }));

  const setVintage = (vintage: string) => {
    const title = retitle(values.title, titleVintage.current, vintage);
    if (title !== values.title) titleVintage.current = vintage;
    setValues({ ...values, vintage, title });
  };

  const disabled = saving ? { disabled: true } : {};
  return (
    <s-stack direction="block" gap="base">
      {failure === undefined ? null : <s-banner tone="critical" heading={failure.message} />}
      <s-heading>Le vin</s-heading>
      <s-stack direction="block" gap="base">
        <s-text-field
          label="Nom du vin"
          value={values.title}
          details="Comme sur le site, avec l’année. L’année du nom suit la case « Année »."
          onInput={(event) => set("title", event.currentTarget.value)}
          {...errorProps(errors, "title")}
          {...disabled}
        />
        <s-text-field label="Producteur" value={values.vendor} onInput={(event) => set("vendor", event.currentTarget.value)} {...errorProps(errors, "vendor")} {...disabled} />
        <s-select label="Sorte" value={values.type} onChange={(event) => set("type", event.currentTarget.value)} {...errorProps(errors, "type")} {...disabled}>
          {values.type === "" ? <s-option value="">Choisir la sorte…</s-option> : null}
          {FICHE_TYPES.map((type) => (
            <s-option key={type} value={type}>
              {type}
            </s-option>
          ))}
        </s-select>
        <s-select
          label="Pays"
          value={values.country}
          details={values.type === "Spiritueux" ? "Facultatif pour un spiritueux." : "Sert au menu du site et aux litres vendus."}
          onChange={(event) => set("country", event.currentTarget.value)}
          {...errorProps(errors, "country")}
          {...disabled}
        >
          <s-option value="">{values.type === "Spiritueux" ? "Aucun" : "Choisir le pays…"}</s-option>
          {WINE_COUNTRIES.map((country) => (
            <s-option key={country} value={country}>
              {country}
            </s-option>
          ))}
        </s-select>
        <s-select
          label="Région (menu du site)"
          value={typingRegion ? OTHER_REGION : values.region}
          details="Le menu « Régions » et les filtres du site rangent le vin sous ce nom."
          onChange={(event) => {
            const choice = event.currentTarget.value;
            setTypingRegion(choice === OTHER_REGION);
            set("region", choice === OTHER_REGION ? "" : choice);
          }}
          {...errorProps(errors, "region")}
          {...disabled}
        >
          <s-option value="">Aucune</s-option>
          {regions.map((region) => (
            <s-option key={region} value={region}>
              {region}
            </s-option>
          ))}
          <s-option value={OTHER_REGION}>Autre région (à écrire)…</s-option>
        </s-select>
        {typingRegion ? (
          <s-text-field
            label="Nom de la nouvelle région"
            value={values.region}
            details="Elle apparaîtra comme nouvelle région dans le menu du site."
            onInput={(event) => set("region", event.currentTarget.value)}
            {...errorProps(errors, "region")}
            {...disabled}
          />
        ) : null}
        <s-text-field
          label="Appellation (facultatif)"
          value={values.appellation}
          details="Ex. Chianti Classico. « Champagne » range le vin parmi les champagnes."
          onInput={(event) => set("appellation", event.currentTarget.value)}
          {...errorProps(errors, "appellation")}
          {...disabled}
        />
        <s-text-field
          label="Année"
          value={values.vintage}
          details="Ex. 2024. Vide pour un vin sans année."
          onInput={(event) => setVintage(event.currentTarget.value.trim())}
          {...errorProps(errors, "vintage")}
          {...disabled}
        />
        <s-select label="Contenance d’une bouteille" value={values.size} details="Sert à compter les litres vendus" onChange={(event) => set("size", event.currentTarget.value)} {...errorProps(errors, "size")} {...disabled}>
          {values.size === "" ? <s-option value="">Choisir la contenance…</s-option> : null}
          {FICHE_SIZE_CHOICES.map((choice) => (
            <s-option key={choice.value} value={choice.value}>
              {choice.label}
            </s-option>
          ))}
        </s-select>
        <s-text-field label="Degré d’alcool (%)" value={values.degre} details="Ex. 13,5" onInput={(event) => set("degre", event.currentTarget.value)} {...errorProps(errors, "degre")} {...disabled} />
        <s-text-field label="Cépages" value={values.cepage} details="Ex. Sangiovese, Merlot" onInput={(event) => set("cepage", event.currentTarget.value)} {...errorProps(errors, "cepage")} {...disabled} />
        <s-text-field
          label="Ligne « Région » de la fiche"
          value={values.regionLine}
          details="Ex. Chianti Classico DOCG, Toscane"
          onInput={(event) => set("regionLine", event.currentTarget.value)}
          {...errorProps(errors, "regionLine")}
          {...disabled}
        />
      </s-stack>
      <s-heading>Les textes de la fiche</s-heading>
      <s-text color="subdued">Un paragraphe par ligne. Une case vidée disparaît du site.</s-text>
      <s-text-area label="Dégustation" value={values.degustation} rows={8} onInput={(event) => set("degustation", event.currentTarget.value)} {...errorProps(errors, "degustation")} {...disabled} />
      <s-text-area
        label="Le producteur"
        value={values.producteur}
        rows={6}
        details="Ne change que pour ce vin : les autres vins du même producteur gardent leur texte."
        onInput={(event) => set("producteur", event.currentTarget.value)}
        {...errorProps(errors, "producteur")}
        {...disabled}
      />
      <s-text-area label="Service" value={values.service} rows={3} onInput={(event) => set("service", event.currentTarget.value)} {...errorProps(errors, "service")} {...disabled} />
      <s-text-area label="Conservation" value={values.conservation} rows={3} onInput={(event) => set("conservation", event.currentTarget.value)} {...errorProps(errors, "conservation")} {...disabled} />
      <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
        <s-button {...FILL} variant="primary" icon="check" onClick={() => onSubmit(values)} {...(saving ? { loading: true } : {})}>
          Enregistrer la fiche
        </s-button>
        <s-button {...FILL} icon="x" onClick={onCancel} {...disabled}>
          Annuler
        </s-button>
      </s-grid>
    </s-stack>
  );
}
