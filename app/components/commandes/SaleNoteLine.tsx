import { useFetcher } from "react-router";
import { SALE_NOTE_INTENT, type SaleNoteActionResult, type SaleNoteView } from "../../lib/abaninja/vente-bon-view";

interface SaleNoteLineProps {
  readonly view: SaleNoteView;
  readonly orderId: string;
}

/** Le bon de livraison AbaNinja de la commande ; « Créer le bon de livraison » s'il manque ou a été refusé. */
export function SaleNoteLine({ view, orderId }: SaleNoteLineProps) {
  const fetcher = useFetcher<SaleNoteActionResult>({ key: `bon-${orderId}` });
  const busy = fetcher.state !== "idle";
  const failed = fetcher.state === "idle" && fetcher.data?.ok === false ? fetcher.data.message : null;

  return (
    <s-section>
      <s-stack direction="block" gap="small-200">
        <s-banner tone={view.tone} heading={view.text}>
          {view.canCreate ? (
            <s-button
              loading={busy}
              onClick={() => fetcher.submit({ intent: SALE_NOTE_INTENT, orderId }, { method: "post" })}
            >
              Créer le bon de livraison
            </s-button>
          ) : null}
        </s-banner>
        {failed === null ? null : <s-banner tone="critical" heading={failed} />}
      </s-stack>
    </s-section>
  );
}
