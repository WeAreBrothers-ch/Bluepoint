import { bottleCountText } from "../../lib/agenda/labels";
import type { OrderDetail, OrderDetailLine } from "../../lib/commandes/detail";
import { formatChf } from "../../lib/format/money";
import { ContactButtons } from "../agenda/TaskCard";

/** Parties de la fiche commande : les vins avec les prix et le total, puis le client. */

/** Libellé à gauche, montant à droite. */
function AmountRow({ label, amount, strong = false }: { readonly label: string; readonly amount: string; readonly strong?: boolean }) {
  const type = strong ? { type: "strong" as const } : {};
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-text {...type}>{label}</s-text>
      <s-text {...type}>{amount}</s-text>
    </s-grid>
  );
}

function WineLine({ line }: { readonly line: OrderDetailLine }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-stack direction="block">
        <s-text type="strong">{`${line.quantity} × ${line.name}`}</s-text>
        {line.unitCents === null ? null : <s-text color="subdued">{`${formatChf(line.unitCents)} la bouteille`}</s-text>}
      </s-stack>
      <s-text>{line.totalCents === null ? "" : formatChf(line.totalCents)}</s-text>
    </s-grid>
  );
}

export function OrderWines({ detail }: { readonly detail: OrderDetail }) {
  const bottles = detail.lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <s-section heading={`Vins (${bottleCountText(bottles)})`}>
      <s-stack direction="block" gap="base">
        {detail.lines.map((line, index) => (
          <WineLine key={`${index}-${line.name}`} line={line} />
        ))}
        <s-divider />
        <s-stack direction="block" gap="small-200">
          {detail.discountCents > 0 && detail.winesCents !== null ? (
            <>
              <AmountRow label="Vins" amount={formatChf(detail.winesCents)} />
              <AmountRow label={detail.discountLabel} amount={`− ${formatChf(detail.discountCents)}`} />
            </>
          ) : null}
          {detail.shippingCents === 0 ? null : <AmountRow label="Frais d’envoi" amount={formatChf(detail.shippingCents)} />}
          {detail.totalCents === null ? null : <AmountRow label="Total" amount={formatChf(detail.totalCents)} strong />}
          {detail.taxCents === null || detail.taxCents === 0 ? null : (
            <s-text color="subdued">{`TVA comprise\u202F: ${formatChf(detail.taxCents)}`}</s-text>
          )}
        </s-stack>
      </s-stack>
    </s-section>
  );
}

export function OrderCustomer({ detail }: { readonly detail: OrderDetail }) {
  const { task } = detail;
  return (
    <s-section heading="Client">
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{task.company ?? task.customerName}</s-text>
        {task.company === null ? null : <s-text>{task.customerName}</s-text>}
        <ContactButtons task={task} />
        {detail.email === null ? null : <s-text color="subdued">{`E-mail\u202F: ${detail.email}`}</s-text>}
      </s-stack>
    </s-section>
  );
}
