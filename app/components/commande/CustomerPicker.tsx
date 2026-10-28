import { longDay } from "../../lib/agenda/dates";
import { productLabel } from "../../lib/commande/totals";
import type { B2bOption, CustomerOption, PhoneOrderLine, ProductOption } from "../../lib/commande/types";
import { CustomerSearch } from "./CustomerSearch";

/** Client de la commande : recherche, puis fiche (adresse, téléphone, entreprise) et reprise de sa dernière commande. */

interface CustomerPickerProps {
  readonly customer: CustomerOption | null;
  readonly b2bLocationId: string | null;
  readonly products: readonly ProductOption[];
  readonly error: string | undefined;
  readonly onSelect: (customer: CustomerOption | null) => void;
  readonly onSelectB2b: (locationId: string | null) => void;
  readonly onRepeat: (lines: readonly PhoneOrderLine[]) => void;
}

type CardProps = Omit<CustomerPickerProps, "customer"> & { readonly customer: CustomerOption };

function locationLabel(option: B2bOption): string {
  return option.locationName === option.companyName ? option.companyName : `${option.companyName} — ${option.locationName}`;
}

/**
 * Client rattaché à une entreprise : la commande est faite au nom de l'entreprise, sans question.
 * On ne demande que l'établissement, et seulement s'il y en a plusieurs.
 */
function CompanyLine({ customer, b2bLocationId, onSelectB2b }: CardProps) {
  const [first] = customer.b2b;
  if (first === undefined) return null;
  if (customer.b2b.length === 1) {
    return (
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-icon type="organization" />
        <s-text>{`Commande au nom de l’entreprise ${first.companyName}`}</s-text>
      </s-stack>
    );
  }
  return (
    <s-choice-list
      label={"Pour quel établissement\u202F?"}
      name="b2b"
      values={[b2bLocationId ?? first.companyLocationId]}
      onChange={(event) => onSelectB2b(event.currentTarget.values[0] ?? first.companyLocationId)}
    >
      {customer.b2b.map((option) => (
        <s-choice key={option.companyLocationId} value={option.companyLocationId}>
          {locationLabel(option)}
        </s-choice>
      ))}
    </s-choice-list>
  );
}

/** « Reprendre sa dernière commande » : seulement les vins encore en vente. */
function RepeatLastOrder({ customer, products, onRepeat }: CardProps) {
  const order = customer.lastOrder;
  if (order === null) return null;
  const byId = new Map(products.map((product) => [product.variantId as string, product]));
  const lines = order.lines.filter((line) => byId.has(line.variantId));
  if (lines.length === 0) return null;
  const summary = lines
    .map((line) => {
      const product = byId.get(line.variantId);
      return product === undefined ? "" : `${line.quantity} × ${productLabel(product)}`;
    })
    .join(", ");
  const when = order.date === null ? order.name : `${order.name} du ${longDay(order.date)}`;
  return (
    <s-box padding="base" border="base" borderRadius="base" background="subdued">
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{`Dernière commande\u202F: ${when}`}</s-text>
        <s-text>{summary}</s-text>
        <s-stack direction="inline">
          <s-button icon="order-repeat" onClick={() => onRepeat(lines)}>
            Reprendre les mêmes vins
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function CustomerCard(props: CardProps) {
  const { customer, onSelect } = props;
  return (
    <s-stack direction="block" gap="base">
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack direction="block" gap="small-300">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-text type="strong">{customer.displayName}</s-text>
            {customer.isPro ? <s-badge tone="info">Client pro</s-badge> : null}
          </s-stack>
          {customer.addressLines.length === 0 ? (
            <s-text tone="caution">
              Ce client n’a pas d’adresse enregistrée. Écrivez l’adresse dans la remarque de livraison, plus bas.
            </s-text>
          ) : (
            customer.addressLines.map((line) => <s-text key={line}>{line}</s-text>)
          )}
          <s-text color="subdued">{customer.phone ?? "Pas de téléphone enregistré"}</s-text>
          {customer.email === null ? null : <s-text color="subdued">{customer.email}</s-text>}
        </s-stack>
      </s-box>
      <CompanyLine {...props} />
      <RepeatLastOrder {...props} />
      <s-stack direction="inline">
        <s-button onClick={() => onSelect(null)}>Choisir un autre client</s-button>
      </s-stack>
    </s-stack>
  );
}

export function CustomerPicker(props: CustomerPickerProps) {
  return (
    <s-section heading="1. Client">
      {props.customer === null ? (
        <CustomerSearch error={props.error} onSelect={props.onSelect} />
      ) : (
        <CustomerCard {...props} customer={props.customer} />
      )}
    </s-section>
  );
}
