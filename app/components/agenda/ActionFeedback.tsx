import type { AgendaActionResult } from "../../lib/agenda/action-result";

/**
 * Résultat d'une action, affiché dans la carte et qui reste visible :
 * réussite, remarque non bloquante (livrée mais pas de facture) ou erreur.
 */

interface ActionFeedbackProps {
  readonly result: AgendaActionResult;
}

function SettingsLink() {
  return <s-link href="/app/reglages">Compléter mes coordonnées</s-link>;
}

export function ActionFeedback({ result }: ActionFeedbackProps) {
  if (result.ok && result.warning === null) return <s-banner tone="success" heading={result.message} />;
  const tone = result.ok ? "warning" : "critical";
  const heading = result.ok ? `${result.message} ${result.warning ?? ""}` : result.message;
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
