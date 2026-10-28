import { useState } from "react";
import { useFetcher } from "react-router";
import { CARTON_SIZES, parseQuantity } from "../../lib/commande/cart";
import { formatChf } from "../../lib/format/money";
import { availableText, bottles, reservedText, type StockActionResult, type StockIntent, type StockItem } from "../../lib/stock/stock";

/**
 * Un vin de la page Stock : combien on peut encore en vendre, puis deux boutons.
 * « Ajouter des bouteilles » quand du vin arrive ; « Corriger le nombre » après avoir compté la cave.
 * Chaque bouton ouvre une petite question à la place des boutons, avec « Annuler ».
 */

interface StockRowProps {
  readonly item: StockItem;
  readonly canEdit: boolean;
}

type Panel = "aucun" | StockIntent;

function LevelBadge({ item }: { readonly item: StockItem }) {
  if (item.level === "epuise") return <s-badge tone="critical">Plus en stock</s-badge>;
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

function ChangePanel({ item, intent, busy, onSubmit, onCancel }: ChangePanelProps) {
  const adding = intent === "ajouter";
  const [quantity, setQuantity] = useState(adding ? 0 : Math.max(item.onHand, 0));
  const ready = adding ? quantity > 0 : true;
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" gap="small-200" alignItems="end">
          <s-box inlineSize="120px">
            <s-number-field
              label={adding ? "Combien de bouteilles arrivent ?" : "Combien de bouteilles avez-vous en cave ?"}
              value={String(quantity)}
              min={0}
              step={1}
              inputMode="numeric"
              onInput={(event) => setQuantity(parseQuantity(event.currentTarget.value))}
            />
          </s-box>
          {adding
            ? CARTON_SIZES.map((size) => (
                <s-button key={size} onClick={() => setQuantity(size)}>
                  {`${size === 6 ? "1 carton" : "2 cartons"} (${size})`}
                </s-button>
              ))
            : null}
        </s-stack>
        {adding ? null : <s-text color="subdued">Comptez aussi les bouteilles des commandes pas encore livrées.</s-text>}
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant="primary"
            icon="check"
            onClick={() => onSubmit(quantity)}
            {...(busy ? { loading: true } : {})}
            {...(ready ? {} : { disabled: true })}
          >
            {adding ? (quantity > 0 ? `Ajouter ${bottles(quantity)}` : "Ajouter") : `Enregistrer ${bottles(quantity)} en cave`}
          </s-button>
          <s-button icon="x" onClick={onCancel} {...(busy ? { disabled: true } : {})}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export function StockRow({ item, canEdit }: StockRowProps) {
  const [panel, setPanel] = useState<Panel>("aucun");
  const fetcher = useFetcher<StockActionResult>({ key: `stock-${item.variantId}` });
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const reserved = reservedText(item);
  const place = item.place;

  const submit = (intent: StockIntent, quantity: number) => {
    if (place === null) return;
    fetcher.submit(
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

  return (
    <s-box padding="base" border="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          {item.imageUrl === null ? <s-thumbnail alt="" size="small" /> : <s-thumbnail src={item.imageUrl} alt={item.imageAlt} size="small" />}
          <s-stack direction="block" gap="small-500">
            <s-text type="strong">{item.label}</s-text>
            {item.priceCents === null ? null : <s-text color="subdued">{formatChf(item.priceCents)}</s-text>}
          </s-stack>
        </s-stack>
        {place === null ? (
          <s-text color="subdued">Le stock de ce vin n’est pas compté.</s-text>
        ) : (
          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text type="strong" {...(item.level === "epuise" ? { tone: "critical" as const } : {})}>
                {availableText(item)}
              </s-text>
              <LevelBadge item={item} />
            </s-stack>
            {reserved === null ? null : <s-text color="subdued">{reserved}</s-text>}
          </s-stack>
        )}
        {place === null || !canEdit ? null : panel === "aucun" ? (
          <s-stack direction="inline" gap="small-200">
            <s-button variant="primary" icon="plus" onClick={() => setPanel("ajouter")} {...(busy ? { loading: true } : {})}>
              Ajouter des bouteilles
            </s-button>
            <s-button icon="edit" onClick={() => setPanel("corriger")} {...(busy ? { disabled: true } : {})}>
              Corriger le nombre
            </s-button>
          </s-stack>
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
      </s-stack>
    </s-box>
  );
}
