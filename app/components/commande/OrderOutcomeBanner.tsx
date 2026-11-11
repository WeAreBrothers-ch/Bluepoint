import { capitalize, longDay } from "../../lib/agenda/dates";
import type { PhoneOrderOutcome } from "../../lib/commande/outcome";
import type { PaymentChoice } from "../../lib/commande/types";

/** Résultat de « Enregistrer la commande » : ce qui a été fait, en clair, et la suite. */

const PAYMENT_TEXT: Readonly<Record<PaymentChoice, string>> = {
  facture: "Le client paiera sur facture.",
  a_la_livraison: "Le client paiera à la livraison.",
  paye: "La commande est notée payée.",
};

export function OrderOutcomeBanner({ outcome }: { readonly outcome: PhoneOrderOutcome }) {
  switch (outcome.kind) {
    case "commande":
      return (
        <s-banner tone="success" heading={`Commande ${outcome.orderName} enregistrée`}>
          <s-stack direction="block" gap="small-200">
            <s-text>{`${capitalize(longDay(outcome.requestedDate))}\u202F: elle est dans « Livraisons ». ${PAYMENT_TEXT[outcome.payment]}`}</s-text>
            {outcome.replayed ? <s-text>{"Elle avait déjà été enregistrée\u202F: aucun doublon."}</s-text> : null}
            {outcome.warnings.map((warning) => (
              <s-text key={warning}>{warning}</s-text>
            ))}
            <s-text>Le formulaire est vidé, prêt pour la commande suivante.</s-text>
            <s-stack direction="inline">
              <s-button href="/app">Voir les livraisons</s-button>
            </s-stack>
          </s-stack>
        </s-banner>
      );
    case "brouillon":
      return (
        <s-banner tone="warning" heading="Commande pas terminée">
          <s-stack direction="block" gap="small-200">
            <s-text>{outcome.message}</s-text>
          </s-stack>
        </s-banner>
      );
    case "en_cours":
      return <s-banner tone="info" heading={outcome.message} />;
    case "invalide":
    case "erreur":
      return <s-banner tone="critical" heading={outcome.message} />;
  }
}
