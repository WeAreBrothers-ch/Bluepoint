import type { ClientInvoice } from "../../lib/clients/detail.server";
import { paymentBadge } from "../../lib/factures/payment";
import { formatChf } from "../../lib/format/money";
import { TITRES } from "../../lib/titres";

/** Sur la fiche du client : ce qu'il doit encore, et ses factures, chacune avec un lien vers « Factures ». */

export function ClientInvoices({ invoices }: { readonly invoices: readonly ClientInvoice[] }) {
  if (invoices.length === 0) return null;
  const unpaid = invoices.filter((invoice) => invoice.state !== "payee");
  const late = unpaid.some((invoice) => invoice.state === "en_retard");
  const owed = unpaid.reduce((sum, invoice) => sum + invoice.totalCents, 0);
  return (
    <s-section heading="Ses factures">
      <s-stack direction="block" gap="base">
        {unpaid.length === 0 ? (
          <s-banner tone="success" heading="Ce client ne doit rien." />
        ) : (
          <s-banner
            tone={late ? "critical" : "warning"}
            heading={`Il reste ${formatChf(owed)} à payer (${unpaid.length} facture${unpaid.length > 1 ? "s" : ""})`}
          />
        )}
        {invoices.map((invoice) => {
          const badge = paymentBadge(invoice.state, invoice.overdueDays);
          return (
            <s-stack key={invoice.id} direction="inline" gap="small-200" alignItems="center" justifyContent="space-between">
              <s-stack direction="block" gap="small-100">
                <s-text type="strong">{`Facture ${invoice.number} · ${formatChf(invoice.totalCents)}`}</s-text>
                <s-text color="subdued">{`Commande ${invoice.orderName}`}</s-text>
              </s-stack>
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-badge tone={badge.tone}>{badge.label}</s-badge>
                <s-button href={`/app/factures?vue=toutes#facture-${invoice.id}`}>{`Voir dans ${TITRES.factures.toLowerCase()}`}</s-button>
              </s-stack>
            </s-stack>
          );
        })}
      </s-stack>
    </s-section>
  );
}
