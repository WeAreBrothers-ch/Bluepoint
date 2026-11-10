import { useFetcher } from "react-router";
import type { TrialActionResult } from "../../lib/abaninja/trial-types";
import { FILL } from "../fill";
import { COPY } from "./trial-copy";

/** Débloquer un essai resté incertain, une fois la vérification faite dans AbaNinja (le serveur revérifie tout). */

const MODAL_ID = "debloquer-abaninja";
const FORM_ACTION = "/app/abaninja";

export function ResolveTrial({ reference }: { readonly reference: string }) {
  const fetcher = useFetcher<TrialActionResult>({ key: "debloquer-abaninja" });
  const busy = fetcher.state !== "idle";
  const answer = fetcher.data;

  const confirm = () => {
    if (fetcher.state !== "idle") return;
    void fetcher.submit({ intent: "debloquer", confirmation: "absente", reference }, { method: "post", action: FORM_ACTION });
  };

  return (
    <s-stack direction="block" gap="base">
      <s-button {...FILL} commandFor={MODAL_ID} command="--show" {...(busy ? { loading: true, disabled: true } : {})}>
        {COPY.resolveButton}
      </s-button>
      <div role="status" aria-live="polite">
        {answer === undefined || answer.kind === "rapport" || answer.kind === "bloque" ? null : (
          <s-banner tone={answer.kind === "debloque" ? "success" : "critical"} heading={answer.message} />
        )}
      </div>
      <s-modal id={MODAL_ID} heading={COPY.resolveHeading}>
        <s-stack direction="block" gap="base">
          <s-paragraph>{`${COPY.resolveReferenceLabel}${reference}`}</s-paragraph>
          <s-paragraph>{COPY.resolveBody}</s-paragraph>
        </s-stack>
        <s-button slot="primary-action" variant="primary" commandFor={MODAL_ID} command="--hide" onClick={confirm}>
          {COPY.resolveConfirm}
        </s-button>
        <s-button slot="secondary-actions" commandFor={MODAL_ID} command="--hide">
          {COPY.cancel}
        </s-button>
      </s-modal>
    </s-stack>
  );
}
