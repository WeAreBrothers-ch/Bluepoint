import { useState } from "react";
import { FILL } from "../fill";
import { ResultBanner } from "./ResultBanner";
import { useClientsAction } from "./useClientsAction";

/**
 * « Relier les N » / « Créer les N » : demande une confirmation, puis traite 15 fiches au plus par toucher
 * et dit ce qui reste. Un nouveau toucher reprend là où le précédent s'est arrêté.
 */

interface BatchButtonProps {
  readonly intent: "relier_tous" | "creer_tous";
  readonly label: string;
  /** La question de confirmation et ce qui se passera. */
  readonly question: string;
  readonly detail: string;
}

export function BatchButton({
  intent,
  label,
  question,
  detail,
}: BatchButtonProps) {
  const action = useClientsAction();
  const [confirming, setConfirming] = useState(false);
  const mine = action.pendingIntent === intent;
  const result = action.result?.intent === intent ? action.result : undefined;
  return (
    <s-box paddingBlockEnd="base">
      <s-stack direction="block" gap="small-200">
        {confirming ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack direction="block" gap="small-200">
              <s-text type="strong">{question}</s-text>
              <s-text>{detail}</s-text>
              <s-grid gridTemplateColumns="minmax(0, 1fr)" gap="small-200">
                <s-button
                  {...FILL}
                  variant="primary"
                  onClick={() => {
                    setConfirming(false);
                    action.submit({ intent });
                  }}
                >
                  Oui, continuer
                </s-button>
                <s-button {...FILL} onClick={() => setConfirming(false)}>
                  Non, annuler
                </s-button>
              </s-grid>
            </s-stack>
          </s-box>
        ) : (
          <s-grid gridTemplateColumns="minmax(0, 1fr)">
            <s-button
              {...FILL}
              variant="primary"
              onClick={() => setConfirming(true)}
              {...(mine ? { loading: true } : {})}
              {...(action.busy ? { disabled: true } : {})}
            >
              {label}
            </s-button>
          </s-grid>
        )}
        <ResultBanner result={result} />
      </s-stack>
    </s-box>
  );
}
