import { TITRES } from "../../lib/titres";
import type { FictitiousOrders } from "../../lib/abaninja/bl-essai-order";
import type { ConfigStatus, TrialPageStatus } from "../../lib/abaninja/trial-types";
import { frenchTypography } from "../../lib/abaninja/trial-typography";
import { DeliveryNoteTrialSection } from "./DeliveryNoteTrialSection";
import { LastTrialSection } from "./LastTrialSection";
import { TestSalesSection } from "./TestSalesSection";
import { TrialSection } from "./TrialSection";
import type { TestSales } from "../../lib/abaninja/vente-essai-types";

/**
 * Page « Connexion AbaNinja » : l'état de la configuration, les factures d'essai faites par « J'ai livré »,
 * l'essai bon de livraison → facture, puis l'essai de connexion.
 */

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

interface AbaNinjaPageViewProps {
  readonly status: TrialPageStatus;
  readonly orders: FictitiousOrders;
  readonly testSales: TestSales;
}

export function AbaNinjaPageView({ status, orders, testSales }: AbaNinjaPageViewProps) {
  return (
    <s-page heading={TITRES.abaninja} inlineSize="base">
      <ConfigBanner config={status.config} />
      <s-section heading={TITRES.clientsAbaninja}>
        <s-stack direction="block" gap="small-200">
          <s-paragraph>Relier les clients d’AbaNinja à ceux de la boutique, ou les y créer, sans doublon.</s-paragraph>
          <s-stack direction="inline">
            <s-button href="/app/clients/abaninja">Ouvrir {TITRES.clientsAbaninja}</s-button>
          </s-stack>
        </s-stack>
      </s-section>
      <TestSalesSection sales={testSales} configured={status.config.kind === "ok"} />
      <DeliveryNoteTrialSection configured={status.config.kind === "ok"} orders={orders} />
      <TrialSection configured={status.config.kind === "ok"} />
      <LastTrialSection status={status} />
    </s-page>
  );
}
