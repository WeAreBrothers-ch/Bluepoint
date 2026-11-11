import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { CARTON_SIZE } from "../../lib/commande/types";
import { formatChf, formatInteger } from "../../lib/format/money";
import type { PhotoResult } from "../../lib/stock/photo";
import type { PriceResult } from "../../lib/stock/price";
import {
  bottles,
  cartonsText,
  confirmationQuestion,
  MAX_CARTONS,
  PALLET_CARTONS,
  parseCount,
  reservedText,
  splitCartons,
  type StockActionResult,
  type StockIntent,
  type StockItem,
} from "../../lib/stock/stock";
import { ClientCard } from "../ClientCard";
import { FILL } from "../fill";
import { PhotoPicker } from "./PhotoPicker";

/**
 * Un vin de la page Stock : combien on peut encore en vendre, puis deux boutons.
 * « Ajouter des cartons » quand du vin arrive (cartons, palettes) ; « Corriger le nombre » après avoir compté la cave.
 * « Ajouter une photo » / « Changer la photo » pour la photo du site.
 * Chaque bouton ouvre une petite question à la place des boutons, avec « Annuler ».
 */

interface StockRowProps {
  readonly item: StockItem;
  readonly canEdit: boolean;
  /** Le droit d'envoyer des photos a été donné à l'app. */
  readonly canPhoto: boolean;
}

type Panel = "aucun" | StockIntent | "photo" | "prix";

function LevelBadge({ item }: { readonly item: StockItem }) {
  if (item.level === "epuise") return <s-badge tone="critical">Plus de bouteilles</s-badge>;
  if (item.level === "bas") return <s-badge tone="warning">Bientôt épuisé</s-badge>;
  return null;
}

interface ChangePanelProps {
  readonly item: StockItem;
  readonly intent: StockIntent;
  readonly busy: boolean;
  readonly onSubmit: (quantity: number) => void;
  readonly onCancel: () => void;
}

/** Boutons qui ajoutent des cartons : on appuie deux fois sur « + 1 palette » pour deux palettes. */
const CARTON_STEPS: readonly { readonly cartons: number; readonly label: string }[] = [
  { cartons: 1, label: "+ 1 carton" },
  { cartons: 5, label: "+ 5 cartons" },
  { cartons: 10, label: "+ 10 cartons" },
  { cartons: PALLET_CARTONS, label: `+ 1 palette (${PALLET_CARTONS} cartons)` },
];

function ChangePanel({ item, intent, busy, onSubmit, onCancel }: ChangePanelProps) {
  const adding = intent === "ajouter";
  const start = splitCartons(item.onHand);
  // Ajout : on compte en cartons. Comptage : cartons pleins, plus les bouteilles des cartons entamés.
  const [fullCartons, setFullCartons] = useState(adding ? 0 : start.cartons);
  const [loose, setLoose] = useState(adding ? 0 : start.loose);
  const quantity = fullCartons * CARTON_SIZE + (adding ? 0 : loose);
  // Une faute de frappe (0, ou 100 cartons au lieu de 10) part dans Shopify : on redemande avant.
  const [asking, setAsking] = useState<string | null>(null);
  const ready = adding ? quantity > 0 : true;
  const submit = () => {
    const question = confirmationQuestion(intent, item.onHand, quantity);
    if (question === null || asking !== null) onSubmit(quantity);
    else setAsking(question);
  };
  if (asking !== null) {
    return (
      <s-box padding="base" background="subdued" borderRadius="base">
        <s-stack direction="block" gap="small-200">
          <s-text type="strong">{asking}</s-text>
          <s-stack direction="inline" gap="small-200">
            <s-button variant="primary" icon="check" onClick={submit} {...(busy ? { loading: true } : {})}>
              Oui, enregistrer
            </s-button>
            <s-button icon="arrow-left" onClick={() => setAsking(null)} {...(busy ? { disabled: true } : {})}>
              Non, corriger
            </s-button>
          </s-stack>
        </s-stack>
      </s-box>
    );
  }
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="base">
        {adding ? (
          <>
            <s-box inlineSize="220px">
              <s-number-field
                label="Combien de cartons arrivent ?"
                value={String(fullCartons)}
                min={0}
                step={1}
                inputMode="numeric"
                details={`${CARTON_SIZE} bouteilles par carton`}
                onInput={(event) => setFullCartons(parseCount(event.currentTarget.value, MAX_CARTONS))}
              />
            </s-box>
            <s-stack direction="inline" gap="small-200">
              {CARTON_STEPS.map((step) => (
                <s-button key={step.cartons} onClick={() => setFullCartons((value) => Math.min(value + step.cartons, MAX_CARTONS))}>
                  {step.label}
                </s-button>
              ))}
              {fullCartons === 0 ? null : (
                <s-button variant="tertiary" icon="reset" onClick={() => setFullCartons(0)}>
                  Remettre à zéro
                </s-button>
              )}
            </s-stack>
          </>
        ) : (
          <>
            <s-stack direction="inline" gap="base" alignItems="end">
              <s-box inlineSize="200px">
                <s-number-field
                  label="Cartons pleins"
                  value={String(fullCartons)}
                  min={0}
                  step={1}
                  inputMode="numeric"
                  onInput={(event) => setFullCartons(parseCount(event.currentTarget.value, MAX_CARTONS))}
                />
              </s-box>
              <s-box inlineSize="200px">
                <s-number-field
                  label="Bouteilles en plus"
                  value={String(loose)}
                  min={0}
                  max={CARTON_SIZE - 1}
                  step={1}
                  inputMode="numeric"
                  details="Cartons entamés"
                  onInput={(event) => setLoose(parseCount(event.currentTarget.value, CARTON_SIZE - 1))}
                />
              </s-box>
            </s-stack>
            <s-text color="subdued">Comptez aussi les cartons des commandes pas encore livrées.</s-text>
          </>
        )}
        <s-text type="strong">{quantity === 0 ? "Total : aucune bouteille" : `Total : ${cartonsText(quantity)} = ${bottles(quantity)}`}</s-text>
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant="primary"
            icon="check"
            onClick={submit}
            {...(busy ? { loading: true } : {})}
            {...(ready ? {} : { disabled: true })}
          >
            {adding ? (quantity > 0 ? `Ajouter ${cartonsText(quantity)}` : "Ajouter") : "Enregistrer ce comptage"}
          </s-button>
          <s-button icon="x" onClick={onCancel} {...(busy ? { disabled: true } : {})}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

interface PhotoPanelProps {
  readonly item: StockItem;
  readonly busy: boolean;
  readonly onSubmit: (photo: File) => void;
  readonly onCancel: () => void;
}

function PhotoPanel({ item, busy, onSubmit, onCancel }: PhotoPanelProps) {
  const [photo, setPhoto] = useState<File | null>(null);
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <PhotoPicker photo={photo} onChange={setPhoto} currentUrl={item.imageUrl} disabled={busy} />
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant="primary"
            icon="check"
            onClick={() => (photo === null ? undefined : onSubmit(photo))}
            {...(busy ? { loading: true } : {})}
            {...(photo === null ? { disabled: true } : {})}
          >
            Enregistrer la photo
          </s-button>
          <s-button icon="x" onClick={onCancel} {...(busy ? { disabled: true } : {})}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

interface PricePanelProps {
  readonly item: StockItem;
  readonly busy: boolean;
  readonly onSubmit: (price: string) => void;
  readonly onCancel: () => void;
}

/** « Modifier le prix » : le prix de vente d'une bouteille, en francs. */
function PricePanel({ item, busy, onSubmit, onCancel }: PricePanelProps) {
  const [price, setPrice] = useState(item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2));
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text-field
          label="Prix d’une bouteille (CHF)"
          details="Ex. 55 ou 55.50. Le prix change tout de suite sur le site et dans « Prendre une commande »."
          value={price}
          onInput={(event) => setPrice(event.currentTarget.value)}
        />
        <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
          <s-button
            {...FILL}
            variant="primary"
            icon="check"
            onClick={() => onSubmit(price)}
            {...(busy ? { loading: true } : {})}
            {...(price.trim() === "" ? { disabled: true } : {})}
          >
            Enregistrer le prix
          </s-button>
          <s-button {...FILL} icon="x" onClick={onCancel} {...(busy ? { disabled: true } : {})}>
            Annuler
          </s-button>
        </s-grid>
      </s-stack>
    </s-box>
  );
}

export function StockRow({ item, canEdit, canPhoto }: StockRowProps) {
  const [panel, setPanel] = useState<Panel>("aucun");
  const fetcher = useFetcher<StockActionResult>({ key: `stock-${item.variantId}` });
  const photoFetcher = useFetcher<PhotoResult>({ key: `photo-${item.productId}` });
  const priceFetcher = useFetcher<PriceResult>({ key: `prix-${item.variantId}` });
  // Shopify prépare la photo quelques secondes : en attendant, on montre celle qui vient d'être envoyée.
  const [sentPhoto, setSentPhoto] = useState<File | null>(null);
  const sentUrl = useMemo(() => (sentPhoto === null ? null : URL.createObjectURL(sentPhoto)), [sentPhoto]);
  useEffect(() => () => (sentUrl === null ? undefined : URL.revokeObjectURL(sentUrl)), [sentUrl]);
  const busy = fetcher.state !== "idle";
  const sendingPhoto = photoFetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const photoResult = photoFetcher.state === "idle" ? photoFetcher.data : undefined;
  const savingPrice = priceFetcher.state !== "idle";
  const priceResult = priceFetcher.state === "idle" ? priceFetcher.data : undefined;
  const imageUrl = item.imageUrl ?? (photoResult?.ok ? sentUrl : null);
  const reserved = reservedText(item);
  const place = item.place;

  const submit = (intent: StockIntent, quantity: number) => {
    if (place === null) return;
    void fetcher.submit(
      {
        intent,
        inventoryItemId: place.inventoryItemId,
        locationId: place.locationId,
        quantity: String(quantity),
        expected: String(intent === "ajouter" ? item.available : item.onHand),
        key: crypto.randomUUID(),
      },
      { method: "post" },
    );
    setPanel("aucun");
  };

  const sendPrice = (price: string) => {
    void priceFetcher.submit({ intent: "prix", productId: item.productId, variantId: item.variantId, price }, { method: "post" });
    setPanel("aucun");
  };

  const sendPhoto = (photo: File) => {
    const data = new FormData();
    data.set("intent", "photo");
    data.set("productId", item.productId);
    data.set("title", item.label);
    data.set("photo", photo, "photo.jpg");
    void photoFetcher.submit(data, { method: "post", encType: "multipart/form-data" });
    setSentPhoto(photo);
    setPanel("aucun");
  };

  // Le vin à recommander met « Ajouter des cartons » en avant ; sinon, tous les boutons sont discrets.
  const restock = item.level === "epuise" || item.level === "bas";
  const canChange = place !== null && canEdit;
  const canPrice = canPhoto; // même autorisation que « Nouveau vin » et la photo (écrire les produits)
  const buttons = (
    <s-stack direction="block" gap="small-200">
      {canChange ? (
        <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
          <s-button {...FILL} variant={restock ? "primary" : "secondary"} icon="plus" onClick={() => setPanel("ajouter")} {...(busy ? { loading: true } : {})}>
            Ajouter des cartons
          </s-button>
        </s-grid>
      ) : null}
      {canChange || canPhoto ? (
        <s-grid gridTemplateColumns={canChange && canPhoto ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)"} gap="small-200">
          {canChange ? (
            <s-button {...FILL} icon="edit" onClick={() => setPanel("corriger")} {...(busy ? { disabled: true } : {})}>
              Corriger le nombre
            </s-button>
          ) : null}
          {canPhoto ? (
            <s-button {...FILL} icon="image" onClick={() => setPanel("photo")} {...(sendingPhoto ? { loading: true } : {})}>
              {imageUrl === null ? "Ajouter une photo" : "Changer la photo"}
            </s-button>
          ) : null}
        </s-grid>
      ) : null}
      {canPrice ? (
        <s-stack direction="inline">
          <s-button variant="tertiary" icon="cash-dollar" onClick={() => setPanel("prix")} {...(savingPrice ? { loading: true } : {})}>
            Modifier le prix
          </s-button>
        </s-stack>
      ) : null}
    </s-stack>
  );

  return (
    <ClientCard
      header={
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {imageUrl === null ? <s-thumbnail alt="" size="small" /> : <s-thumbnail src={imageUrl} alt={item.imageAlt} size="small" />}
          <s-stack direction="block" gap="small-500">
            <s-heading>{item.label}</s-heading>
            {item.priceCents === null ? null : <s-text color="subdued">{formatChf(item.priceCents)}</s-text>}
          </s-stack>
        </s-stack>
      }
    >
        {place === null ? (
          <s-text color="subdued">Les bouteilles de ce vin ne sont pas comptées.</s-text>
        ) : (
          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text type="strong" {...(item.level === "epuise" ? { tone: "critical" as const } : {})}>
                <span style={{ fontSize: "32px", lineHeight: 1.1 }}>{formatInteger(splitCartons(item.available).cartons)}</span>
              </s-text>
              <s-text color="subdued">
                {`${splitCartons(item.available).cartons > 1 ? "cartons" : "carton"} à vendre${
                  splitCartons(item.available).loose > 0 ? ` + ${bottles(splitCartons(item.available).loose)}` : ""
                } (${bottles(Math.max(item.available, 0))})`}
              </s-text>
              <LevelBadge item={item} />
            </s-stack>
            {reserved === null ? null : <s-text color="subdued">{reserved}</s-text>}
          </s-stack>
        )}
        {panel === "aucun" ? (
          buttons
        ) : panel === "prix" ? (
          <PricePanel item={item} busy={savingPrice} onSubmit={sendPrice} onCancel={() => setPanel("aucun")} />
        ) : panel === "photo" ? (
          <PhotoPanel item={item} busy={sendingPhoto} onSubmit={sendPhoto} onCancel={() => setPanel("aucun")} />
        ) : (
          <ChangePanel
            item={item}
            intent={panel}
            busy={busy}
            onSubmit={(quantity) => submit(panel, quantity)}
            onCancel={() => setPanel("aucun")}
          />
        )}
        {result === undefined ? null : <s-banner tone={result.ok ? "success" : "critical"} heading={result.message} />}
        {priceResult === undefined ? null : <s-banner tone={priceResult.ok ? "success" : "critical"} heading={priceResult.message} />}
        {photoResult === undefined ? null : <s-banner tone={photoResult.ok ? "success" : "critical"} heading={photoResult.message} />}
    </ClientCard>
  );
}
