import { formatSwissDateTime } from "../../lib/format/dates";
import { NNBSP } from "../../lib/format/typography";
import { trialClientName } from "../../lib/abaninja/trial-fixtures";
import type { LastTrialSummary, TrialPageStatus } from "../../lib/abaninja/trial-types";
import { frenchTypography } from "../../lib/abaninja/trial-typography";
import { ResolveTrial } from "./ResolveTrial";
import { COPY } from "./trial-copy";
import { issueText, stateText } from "./trial-labels";

/** « Dernier essai » : ce qui s'est passé, la référence à chercher dans AbaNinja, et ce qu'il reste à faire à la main. */

function CleanupReminder({ trial }: { readonly trial: LastTrialSummary }) {
  if (trial.cleanupIssue === null) return null;
  const heading = trial.cleanupIssue === "non_brouillon" ? "À vérifier dans AbaNinja" : "À supprimer à la main dans AbaNinja";
  const what = frenchTypography(`La facture de référence ${trial.reference}, puis le client « ${trialClientName(trial.reference)} ».`);
  return (
    <s-banner tone="warning" heading={frenchTypography(heading)}>
      <s-paragraph>{what}</s-paragraph>
      <s-paragraph>{issueText(trial.cleanupIssue)}</s-paragraph>
    </s-banner>
  );
}

function ResolveBlock({ trial }: { readonly trial: LastTrialSummary }) {
  if (trial.resolve.kind === "non") return null;
  if (trial.resolve.kind === "attente") {
    return <s-text color="subdued">{`${COPY.resolveWaitPrefix} ${trial.resolve.minutes} min.`}</s-text>;
  }
  return <ResolveTrial reference={trial.reference} />;
}

function LastTrial({ trial }: { readonly trial: LastTrialSummary }) {
  const number = trial.invoiceNumber === null ? "" : `, facture n° ${trial.invoiceNumber}`;
  return (
    <s-stack direction="block" gap="base">
      <s-text>{`Le ${formatSwissDateTime(new Date(trial.createdAt))}${NNBSP}: ${stateText(trial.state)}.`}</s-text>
      <s-text color="subdued">{`${COPY.resolveReferenceLabel}${trial.reference}${number}`}</s-text>
      <CleanupReminder trial={trial} />
      <ResolveBlock trial={trial} />
    </s-stack>
  );
}

export function LastTrialSection({ status }: { readonly status: TrialPageStatus }) {
  return (
    <s-section heading="Dernier essai">
      {!status.historyReadable ? (
        <s-text>{COPY.unreadable}</s-text>
      ) : status.lastTrial === null ? (
        <s-text>{COPY.noTrial}</s-text>
      ) : (
        <LastTrial trial={status.lastTrial} />
      )}
    </s-section>
  );
}
