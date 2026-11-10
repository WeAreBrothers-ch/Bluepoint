import { TITRES } from "../../lib/titres";
import type { ConfigStatus, TrialPageStatus } from "../../lib/abaninja/trial-types";
import { frenchTypography } from "../../lib/abaninja/trial-typography";
import { LastTrialSection } from "./LastTrialSection";
import { TrialSection } from "./TrialSection";

/** Page « Connexion AbaNinja » : l'état de la configuration, le dernier essai, et le bouton d'essai. */

const OK_HEADING = frenchTypography("Les accès AbaNinja sont enregistrés et bien formés.");
const OK_DETAIL = frenchTypography("Seul un essai montre qu’AbaNinja les accepte vraiment.");
const HELP = " Demandez à la personne qui s’occupe de l’application de le corriger, puis revenez ici.";

function ConfigBanner({ config }: { readonly config: ConfigStatus }) {
  if (config.kind === "ok") {
    return (
      <s-banner tone="info" heading={OK_HEADING}>
        {OK_DETAIL}
      </s-banner>
    );
  }
  const heading = config.kind === "absente" ? "Il manque un accès AbaNinja" : "Un accès AbaNinja est mal enregistré";
  return (
    <s-banner tone="warning" heading={heading}>
      {frenchTypography(`${config.message}${HELP}`)}
    </s-banner>
  );
}

export function AbaNinjaPageView({ status }: { readonly status: TrialPageStatus }) {
  return (
    <s-page heading={TITRES.abaninja} inlineSize="base">
      <ConfigBanner config={status.config} />
      <TrialSection configured={status.config.kind === "ok"} />
      <LastTrialSection status={status} />
    </s-page>
  );
}
