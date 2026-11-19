import { useFetcher } from "react-router";
import { frenchTypography } from "../../lib/abaninja/trial-typography";
import { ERASE_TEST_SALES_INTENT, type TestSales, type TestSalesEraseOutcome } from "../../lib/abaninja/vente-essai-types";
import { FILL } from "../fill";

/** Factures faites dans AbaNinja par « J'ai livré » sur des commandes fictives, et le bouton qui les efface. */

const COPY = {
  heading: "Factures d’essai faites par « J’ai livré »",
  intro: frenchTypography(
    "Sur une commande étiquetée « fictif » et pas encore payée, « J’ai livré la commande » fait la facture dans AbaNinja : un client d’essai et une facture en brouillon, que vous envoyez depuis l’app avec les boutons habituels. Les vraies commandes ne changent pas. Après vos essais, effacez tout ici.",
  ),
  none: frenchTypography("Aucune facture d’essai pour l’instant."),
  unavailable: frenchTypography("La liste n’a pas pu être lue. Rechargez la page dans un instant."),
  erase: "Effacer les factures d’essai",
  busy: frenchTypography("Effacement en cours, ne quittez pas la page."),
} as const;

function SalesList({ sales }: { readonly sales: TestSales }) {
  if (!sales.available) return <s-paragraph color="subdued">{COPY.unavailable}</s-paragraph>;
  if (sales.items.length === 0) return <s-paragraph color="subdued">{COPY.none}</s-paragraph>;
  return (
    <s-unordered-list>
      {sales.items.map((item) => (
        <s-list-item key={`${item.orderName}-${item.label}`}>{frenchTypography(`${item.orderName} : ${item.label}`)}</s-list-item>
      ))}
    </s-unordered-list>
  );
}

function OutcomeBanner({ outcome }: { readonly outcome: TestSalesEraseOutcome }) {
  return (
    <s-banner tone={outcome.tone} heading={outcome.heading}>
      {outcome.details.length > 0 && (
        <s-unordered-list>
          {outcome.details.map((line) => (
            <s-list-item key={line}>{line}</s-list-item>
          ))}
        </s-unordered-list>
      )}
    </s-banner>
  );
}

export function TestSalesSection({ sales, configured }: { readonly sales: TestSales; readonly configured: boolean }) {
  const fetcher = useFetcher<TestSalesEraseOutcome>({ key: "effacer-factures-essai" });
  const busy = fetcher.state !== "idle";
  const outcome = busy ? undefined : fetcher.data;
  const erase = () => {
    if (fetcher.state === "idle") void fetcher.submit({ intent: ERASE_TEST_SALES_INTENT }, { method: "post", action: "/app/abaninja" });
  };
  return (
    <>
      <s-section heading={COPY.heading}>
        <s-stack direction="block" gap="base">
          <s-paragraph>{COPY.intro}</s-paragraph>
          <SalesList sales={sales} />
          {sales.items.length > 0 && (
            <s-button {...FILL} tone="critical" onClick={erase} {...(busy || !configured ? { disabled: true } : {})} {...(busy ? { loading: true } : {})}>
              {COPY.erase}
            </s-button>
          )}
          <div role="status" aria-live="polite">
            <s-text color="subdued">{busy ? COPY.busy : ""}</s-text>
          </div>
        </s-stack>
      </s-section>
      {outcome !== undefined && <OutcomeBanner outcome={outcome} />}
    </>
  );
}
