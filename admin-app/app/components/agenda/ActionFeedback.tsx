import type { AgendaActionResult } from "../../lib/agenda/action-result";

/** Message sous une tâche après une action : erreur, ou remarque non bloquante. */

interface ActionFeedbackProps {
  readonly result: AgendaActionResult;
}

function SettingsLink() {
  return <s-link href="/app/reglages">Compléter les réglages</s-link>;
}

export function ActionFeedback({ result }: ActionFeedbackProps) {
  if (result.ok && result.warning === null) return null;
  const tone = result.ok ? "warning" : "critical";
  const heading = result.ok ? (result.warning ?? "") : result.message;
  const details = result.ok ? result.warningDetails : result.details;
  return (
    <s-banner tone={tone} heading={heading}>
      <s-stack direction="block" gap="small-200">
        {details.map((detail) => (
          <s-text key={detail}>{detail}</s-text>
        ))}
        {result.settingsLink ? <SettingsLink /> : null}
      </s-stack>
    </s-banner>
  );
}
