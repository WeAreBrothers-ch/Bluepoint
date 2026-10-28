import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { addQuantity, setQuantity, type Quantities } from "../../lib/commande/cart";
import type { ProductOption, VariantGid } from "../../lib/commande/types";
import { quantitiesFromLines, type ChangeRules, type OrderChangeResult } from "../../lib/commandes/change";
import type { OrderDetail } from "../../lib/commandes/detail";
import { formatChf } from "../../lib/format/money";
import { ProductList } from "../commande/ProductList";

/**
 * Le client change d'avis sur une commande pas encore livrée : « Modifier les vins » (le même choix
 * des vins que « Prendre une commande ») ou « Annuler la commande », toujours avec une confirmation.
 * Les deux écrans partagent le même envoi, pour que le résultat reste affiché après la fermeture.
 */

const fetcherKey = (orderId: string) => `commande-change-${orderId}`;

interface OrderChangeSectionProps {
  readonly detail: OrderDetail;
  readonly rules: ChangeRules;
  readonly onEdit: () => void;
}

function ResultBanner({ result }: { readonly result: OrderChangeResult }) {
  return (
    <s-banner tone={result.ok ? "success" : "critical"} heading={result.message}>
      {result.ok && result.intent === "annuler" ? <s-button href="/app">Retour à l’agenda</s-button> : null}
    </s-banner>
  );
}

export function OrderChangeSection({ detail, rules, onEdit }: OrderChangeSectionProps) {
  const fetcher = useFetcher<OrderChangeResult>({ key: fetcherKey(detail.task.orderId) });
  const [confirming, setConfirming] = useState(false);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const cancelled = result?.ok === true && result.intent === "annuler";
  const total = detail.totalCents === null ? "" : ` de ${formatChf(detail.totalCents)}`;

  if (cancelled) {
    return (
      <s-section>
        <ResultBanner result={result} />
      </s-section>
    );
  }

  return (
    <s-section heading="Changer ou annuler la commande">
      <s-stack direction="block" gap="base">
        {confirming ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong">{`Annuler la commande ${detail.task.name}\u202F?`}</s-text>
              <s-text>Les bouteilles retournent dans le stock, et la commande disparaît de l’agenda.</s-text>
              {rules.paid ? <s-text>{`Le client a déjà payé${total}\u202F: il sera remboursé.`}</s-text> : null}
              <s-stack direction="inline" gap="small-200">
                <s-button
                  variant="primary"
                  tone="critical"
                  icon="x"
                  onClick={() => {
                    setConfirming(false);
                    fetcher.submit({ intent: "annuler", orderId: detail.task.orderId }, { method: "post" });
                  }}
                >
                  Oui, annuler la commande
                </s-button>
                <s-button onClick={() => setConfirming(false)}>Non, garder la commande</s-button>
              </s-stack>
            </s-stack>
          </s-box>
        ) : (
          <s-stack direction="block" gap="small-200">
            <s-text color="subdued">Le client a appelé pour changer quelque chose ? C’est ici.</s-text>
            <s-stack direction="inline" gap="small-200">
              {rules.canEdit ? (
                <s-button icon="edit" onClick={onEdit} {...(busy ? { disabled: true } : {})}>
                  Modifier les vins
                </s-button>
              ) : null}
              <s-button tone="critical" icon="x" onClick={() => setConfirming(true)} {...(busy ? { loading: true } : {})}>
                Annuler la commande
              </s-button>
            </s-stack>
            {rules.editBlocked === null ? null : <s-text color="subdued">{rules.editBlocked}</s-text>}
          </s-stack>
        )}
        {result === undefined ? null : <ResultBanner result={result} />}
      </s-stack>
    </s-section>
  );
}

interface OrderEditorProps {
  readonly detail: OrderDetail;
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly onClose: () => void;
}

export function OrderEditor({ detail, products, truncated, onClose }: OrderEditorProps) {
  const fetcher = useFetcher<OrderChangeResult>({ key: fetcherKey(detail.task.orderId) });
  const initial = useMemo(() => quantitiesFromLines(detail.lines), [detail.lines]);
  const [quantities, setQuantities] = useState<Quantities>(initial);
  const [submitted, setSubmitted] = useState(false);
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  // Les bouteilles déjà réservées pour cette commande restent à elle : on les compte comme disponibles.
  const editable = useMemo(
    () => products.map((product) => (product.available === null ? product : { ...product, available: product.available + (initial[product.variantId] ?? 0) })),
    [products, initial],
  );
  const fixedLines = detail.lines.filter((line) => line.variantId === null);

  useEffect(() => {
    if (submitted && result?.ok === true && result.intent === "modifier") onClose();
  }, [submitted, result, onClose]);

  return (
    <>
      <ProductList
        heading="Modifier les vins"
        products={editable}
        truncated={truncated}
        quantities={quantities}
        onSet={(variantId: VariantGid, quantity: number) => setQuantities((current) => setQuantity(current, variantId, quantity))}
        onAdd={(variantId: VariantGid, delta: number) => setQuantities((current) => addQuantity(current, variantId, delta))}
      />
      <s-section>
        <s-stack direction="block" gap="base">
          {fixedLines.length === 0 ? null : (
            <s-text color="subdued">{`Ne change pas ici\u202F: ${fixedLines.map((line) => line.name).join(", ")}.`}</s-text>
          )}
          <s-text color="subdued">La remise pro est recalculée toute seule. Le nouveau total s’affiche après l’enregistrement.</s-text>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="primary"
              icon="check"
              onClick={() => {
                setSubmitted(true);
                fetcher.submit({ intent: "modifier", orderId: detail.task.orderId, quantities: JSON.stringify(quantities) }, { method: "post" });
              }}
              {...(busy ? { loading: true } : {})}
            >
              Enregistrer les changements
            </s-button>
            <s-button icon="x" onClick={onClose} {...(busy ? { disabled: true } : {})}>
              Laisser comme avant
            </s-button>
          </s-stack>
          {submitted && result !== undefined && !result.ok ? <ResultBanner result={result} /> : null}
        </s-stack>
      </s-section>
    </>
  );
}
