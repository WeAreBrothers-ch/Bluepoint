import { useState } from "react";
import { useFetcher } from "react-router";
import type { TrialActionResult } from "../../lib/abaninja/trial-types";
import { FILL } from "../fill";
import { TrialBlockedView, TrialReportView } from "./TrialReportView";
import { COPY } from "./trial-copy";

/** Le bouton « Lancer un essai », sa confirmation, puis le résultat. Le bouton est bloqué pendant l'essai. */

const MODAL_ID = "essai-abaninja";
const FORM_ACTION = "/app/abaninja";

function ConfirmModal({ keep, onKeepChange, onStart }: {
  readonly keep: boolean;
  readonly onKeepChange: (value: boolean) => void;
  readonly onStart: () => void;
}) {
  return (
    <s-modal id={MODAL_ID} heading={COPY.modalHeading}>
      <s-stack direction="block" gap="base">
        <s-paragraph>{COPY.modalBody}</s-paragraph>
        <s-paragraph color="subdued">{COPY.modalNumber}</s-paragraph>
        <s-checkbox
          label={COPY.keepLabel}
          details={COPY.keepDetails}
          checked={keep}
          onChange={(event) => onKeepChange(event.currentTarget.checked)}
        />
      </s-stack>
      <s-button slot="primary-action" variant="primary" commandFor={MODAL_ID} command="--hide" onClick={onStart}>
        {COPY.start}
      </s-button>
      <s-button slot="secondary-actions" commandFor={MODAL_ID} command="--hide">
        {COPY.cancel}
      </s-button>
    </s-modal>
  );
}

function Outcome({ result }: { readonly result: TrialActionResult | undefined }) {
  if (result === undefined || result.kind === "debloque") return null;
  if (result.kind === "erreur") return <s-banner tone="critical" heading={result.message} />;
  if (result.kind === "bloque") return <TrialBlockedView message={result.message} />;
  return <TrialReportView report={result.report} />;
}

/** Phrase courte annoncée aux lecteurs d'écran quand l'essai commence et quand il se termine. */
function statusLine(busy: boolean, result: TrialActionResult | undefined): string {
  if (busy) return COPY.busy;
  return result === undefined || result.kind === "debloque" ? "" : COPY.finished;
}

export function TrialSection({ configured }: { readonly configured: boolean }) {
  const fetcher = useFetcher<TrialActionResult>({ key: "essai-abaninja" });
  const [keep, setKeep] = useState(false);
  const busy = fetcher.state !== "idle";

  const start = () => {
    if (fetcher.state !== "idle") return;
    const fields = { intent: "essai", confirmation: "oui", ...(keep ? { garder: "on" } : {}) };
    void fetcher.submit(fields, { method: "post", action: FORM_ACTION });
  };

  return (
    <>
      <s-section heading="Faire un essai">
        <s-stack direction="block" gap="base">
          <s-paragraph>{COPY.intro}</s-paragraph>
          <s-button
            {...FILL}
            variant="primary"
            commandFor={MODAL_ID}
            command="--show"
            {...(busy ? { loading: true, disabled: true } : {})}
            {...(configured ? {} : { disabled: true })}
          >
            {busy ? COPY.running : COPY.launch}
          </s-button>
          <div role="status" aria-live="polite">
            <s-text color="subdued">{statusLine(busy, fetcher.data)}</s-text>
          </div>
        </s-stack>
      </s-section>
      <Outcome result={busy ? undefined : fetcher.data} />
      <ConfirmModal keep={keep} onKeepChange={setKeep} onStart={start} />
    </>
  );
}
