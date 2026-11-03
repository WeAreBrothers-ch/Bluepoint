import type { OrderDetail } from "../../lib/agenda/detail/mapping";
import { formatSwissDate } from "../../lib/format/dates";
import { formatChf, formatInteger } from "../../lib/format/money";
import { NBSP, withColon } from "../../lib/format/typography";

/** Contenu de la fenêtre de détail : bouteilles, montants, client, paiement, note. */

function AmountRow({ label, cents, strong = false }: { readonly label: string; readonly cents: number; readonly strong?: boolean }) {
  const type = strong ? "strong" : "generic";
  return (
    <s-stack direction="inline" justifyContent="space-between" gap="base">
      <s-text type={type}>{label}</s-text>
      <s-text type={type} fontVariantNumeric="tabular-nums">{formatChf(cents)}</s-text>
    </s-stack>
  );
}

function Lines({ detail }: { readonly detail: OrderDetail }) {
  const bottles = detail.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <s-stack direction="block" gap="small-200">
      <s-heading>{`${formatInteger(bottles)}${NBSP}bouteille${bottles > 1 ? "s" : ""}`}</s-heading>
      {detail.lines.map((line) => (
        <s-stack key={line.id} direction="inline" justifyContent="space-between" gap="base">
          <s-stack direction="block">
            <s-text>{`${formatInteger(line.quantity)} × ${line.label}`}</s-text>
            <s-text color="subdued" fontVariantNumeric="tabular-nums">{`${formatChf(line.unitCents)} la bouteille`}</s-text>
          </s-stack>
          <s-text fontVariantNumeric="tabular-nums">{formatChf(line.totalCents)}</s-text>
        </s-stack>
      ))}
      {detail.linesTruncated ? (
        <s-text color="subdued">Liste incomplète : ouvrez la commande dans Shopify pour tout voir.</s-text>
      ) : null}
      <s-divider />
      {detail.discountCents > 0 ? <AmountRow label="Remise" cents={-detail.discountCents} /> : null}
      {detail.shippingCents > 0 ? <AmountRow label="Livraison" cents={detail.shippingCents} /> : null}
      <AmountRow label={detail.taxesIncluded ? "Total TTC" : "Total"} cents={detail.totalCents} strong />
      {detail.taxCents > 0 ? (
        <s-text color="subdued" fontVariantNumeric="tabular-nums">
          {`${detail.taxesIncluded ? "Dont TVA" : "TVA"} ${formatChf(detail.taxCents)}`}
        </s-text>
      ) : null}
    </s-stack>
  );
}

function Customer({ detail }: { readonly detail: OrderDetail }) {
  const { contact } = detail;
  return (
    <s-stack direction="block" gap="small-200">
      <s-heading>Client et adresse</s-heading>
      {detail.addressLines.length === 0 ? (
        <s-text color="subdued">{contact.name ?? "Aucune adresse de livraison"}</s-text>
      ) : (
        <s-stack direction="block">
          {detail.addressLines.map((line, index) => <s-text key={index}>{line}</s-text>)}
        </s-stack>
      )}
      {contact.phone === null ? null : <s-link href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</s-link>}
      {contact.email === null ? null : <s-link href={`mailto:${contact.email}`}>{contact.email}</s-link>}
    </s-stack>
  );
}

function paymentText(detail: OrderDetail): string {
  if (detail.outstandingCents <= 0) return "Payée";
  const due = detail.paymentTerms?.dueOn ?? null;
  const rest = `${formatChf(detail.outstandingCents)} à payer`;
  return due === null ? rest : `${rest}, au plus tard le ${formatSwissDate(due)}`;
}

export function OrderDetailBody({ detail }: { readonly detail: OrderDetail }) {
  return (
    <s-stack direction="block" gap="large">
      <s-text color="subdued">{`Passée le ${formatSwissDate(detail.createdOn)}`}</s-text>
      <Lines detail={detail} />
      <Customer detail={detail} />
      <s-stack direction="block" gap="small-200">
        <s-heading>Paiement</s-heading>
        <s-text>{paymentText(detail)}</s-text>
        {detail.paymentTerms === null ? null : <s-text color="subdued">{`${withColon("Conditions")} ${detail.paymentTerms.name}`}</s-text>}
      </s-stack>
      {detail.note === null ? null : (
        <s-stack direction="block" gap="small-200">
          <s-heading>Note</s-heading>
          <s-text>{detail.note}</s-text>
        </s-stack>
      )}
    </s-stack>
  );
}
