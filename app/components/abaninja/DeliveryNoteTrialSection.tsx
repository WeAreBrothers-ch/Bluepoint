import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { FictitiousOrders } from "../../lib/abaninja/bl-essai-order";
import type { DeliveryNoteTrialOutcome, TrialDocuments } from "../../lib/abaninja/bl-essai-types";
import { FILL } from "../fill";
import { BL_COPY } from "./bl-essai-copy";
import { storeTrial, useStoredTrial } from "./bl-essai-storage";

/** Les trois boutons de l'essai « bon de livraison → facture » et le résultat de la dernière étape. */

const FORM_ACTION = "/app/abaninja";

type Submit = (fields: Record<string, string>) => void;

function documentFields(intent: string, documents: TrialDocuments): Record<string, string> {
  return { intent, noteUuid: documents.noteUuid, invoiceUuid: documents.invoiceUuid ?? "", reference: documents.reference };
}

function CreateStep({ orders, busy, configured, submit }: {
  readonly orders: FictitiousOrders;
  readonly busy: boolean;
  readonly configured: boolean;
  readonly submit: Submit;
}) {
  const [orderId, setOrderId] = useState(orders.options[0]?.id ?? "");
  if (!orders.available) return <s-paragraph color="subdued">{BL_COPY.ordersUnavailable}</s-paragraph>;
  if (orders.options.length === 0) return <s-paragraph color="subdued">{BL_COPY.noOrders}</s-paragraph>;
  return (
    <>
      <s-select label={BL_COPY.orderLabel} value={orderId} onChange={(event) => setOrderId(event.currentTarget.value)}>
        {orders.options.map((option) => (
          <s-option key={option.id} value={option.id}>
            {option.label}
          </s-option>
        ))}
      </s-select>
      <s-button
        {...FILL}
        variant="primary"
        onClick={() => submit({ intent: "bl-creer", orderId })}
        {...(busy || !configured || orderId === "" ? { disabled: true } : {})}
        {...(busy ? { loading: true } : {})}
      >
        {BL_COPY.create}
      </s-button>
    </>
  );
}

function NextSteps({ documents, busy, submit }: { readonly documents: TrialDocuments; readonly busy: boolean; readonly submit: Submit }) {
  const waiting = busy ? { loading: true, disabled: true } : {};
  return (
    <>
      <s-paragraph>
        {BL_COPY.current}
        <s-text type="strong">{documents.reference}</s-text>
      </s-paragraph>
      {documents.invoiceUuid === null ? (
        <>
          <s-button {...FILL} variant="primary" onClick={() => submit(documentFields("bl-facturer", documents))} {...waiting}>
            {BL_COPY.convert}
          </s-button>
          <s-paragraph color="subdued">{BL_COPY.convertNote}</s-paragraph>
          <s-button {...FILL} onClick={() => submit(documentFields("bl-effacer", documents))} {...waiting}>
            {BL_COPY.eraseEarly}
          </s-button>
        </>
      ) : (
        <s-button {...FILL} variant="primary" tone="critical" onClick={() => submit(documentFields("bl-effacer", documents))} {...waiting}>
          {BL_COPY.erase}
        </s-button>
      )}
    </>
  );
}

function OutcomeBanner({ outcome }: { readonly outcome: DeliveryNoteTrialOutcome }) {
  return (
    <s-banner tone={outcome.tone} heading={outcome.heading}>
      {outcome.details.length > 0 && (
        <s-unordered-list>
          {outcome.details.map((line) => (
            <s-list-item key={line}>{line}</s-list-item>
          ))}
        </s-unordered-list>
      )}
    </s-banner>
  );
}

export function DeliveryNoteTrialSection({ configured, orders }: { readonly configured: boolean; readonly orders: FictitiousOrders }) {
  const fetcher = useFetcher<DeliveryNoteTrialOutcome>({ key: "essai-bon-livraison" });
  const stored = useStoredTrial();
  const busy = fetcher.state !== "idle";
  const outcome = busy ? undefined : fetcher.data;
  const documents = fetcher.data === undefined ? stored : fetcher.data.documents;

  useEffect(() => {
    if (fetcher.data !== undefined) storeTrial(fetcher.data.documents);
  }, [fetcher.data]);

  const submit: Submit = (fields) => {
    if (fetcher.state !== "idle") return;
    void fetcher.submit(fields, { method: "post", action: FORM_ACTION });
  };

  return (
    <>
      <s-section heading={BL_COPY.heading}>
        <s-stack direction="block" gap="base">
          <s-paragraph>{BL_COPY.intro}</s-paragraph>
          {documents === null ? (
            <CreateStep orders={orders} busy={busy} configured={configured} submit={submit} />
          ) : (
            <NextSteps documents={documents} busy={busy} submit={submit} />
          )}
          <div role="status" aria-live="polite">
            <s-text color="subdued">{busy ? BL_COPY.busy : outcome === undefined ? "" : BL_COPY.finished}</s-text>
          </div>
        </s-stack>
      </s-section>
      {outcome !== undefined && <OutcomeBanner outcome={outcome} />}
    </>
  );
}
