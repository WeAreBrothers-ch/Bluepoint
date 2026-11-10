import type { TrialReport, TrialStep } from "../../lib/abaninja/trial-types";
import { frenchTypography } from "../../lib/abaninja/trial-typography";
import { COPY } from "./trial-copy";
import { OUTCOME_TEXT } from "./trial-labels";

/** Le rapport d'un essai : un titre, les étapes une par une (symbole + mot), puis quoi faire. */

const REFERENCE_LABEL = frenchTypography("Référence de la facture d’essai : ");

function StepRow({ step, index }: { readonly step: TrialStep; readonly index: number }) {
  return (
    <s-box padding="base" border="base" borderRadius="base" {...(step.outcome === "echec" ? { background: "subdued" as const } : {})}>
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{`${index + 1}. ${step.label}`}</s-text>
        <s-text type="strong">{OUTCOME_TEXT[step.outcome]}</s-text>
        <s-paragraph>{step.message}</s-paragraph>
      </s-stack>
    </s-box>
  );
}

interface HelpListProps {
  readonly heading: string;
  readonly items: readonly string[];
  readonly tone: "warning" | "info";
}

function HelpList({ heading, items, tone }: HelpListProps) {
  if (items.length === 0) return null;
  return (
    <s-banner tone={tone} heading={heading}>
      <s-ordered-list>
        {items.map((item) => (
          <s-list-item key={item}>{item}</s-list-item>
        ))}
      </s-ordered-list>
    </s-banner>
  );
}

export function TrialReportView({ report }: { readonly report: TrialReport }) {
  const tone = report.ok && report.manualCleanup.length === 0 ? "success" : report.ok ? "warning" : "critical";
  return (
    <s-section heading="Résultat de l’essai">
      <s-stack direction="block" gap="base">
        <s-banner tone={tone} heading={report.headline} />
        {report.reference === null ? null : <s-text color="subdued">{`${REFERENCE_LABEL}${report.reference}`}</s-text>}
        {report.steps.map((step, index) => (
          <StepRow key={step.key} step={step} index={index} />
        ))}
        <HelpList heading={frenchTypography("À faire à la main dans AbaNinja")} tone="warning" items={report.manualCleanup} />
        <HelpList heading="Bon à savoir" tone="info" items={report.notes} />
        {report.ok ? null : <s-paragraph color="subdued">{COPY.failureHelp}</s-paragraph>}
      </s-stack>
    </s-section>
  );
}

/** Essai refusé avant de commencer : pas de liste d'étapes, seulement pourquoi et quand réessayer. */
export function TrialBlockedView({ message }: { readonly message: string }) {
  return (
    <s-section heading={COPY.blockedHeading}>
      <s-stack direction="block" gap="base">
        <s-banner tone="info" heading={message} />
        <s-text color="subdued">{COPY.blockedNote}</s-text>
      </s-stack>
    </s-section>
  );
}
