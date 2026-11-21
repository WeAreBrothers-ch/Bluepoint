import type { ReactNode } from "react";
import type { CardView } from "../../lib/clients-abaninja/view";
import { ClientCard } from "../ClientCard";
import { IconHeading } from "../IconHeading";

/** Une fiche AbaNinja : son nom, son numéro, son e-mail et son lieu, puis ce qu'on peut en faire. */

export function cardSubtitle(card: CardView): string {
  return card.number === null ? `${card.kindLabel} · fiche AbaNinja` : `${card.kindLabel} · fiche AbaNinja n°\u00A0${card.number}`;
}

export function CardRow({ card, children }: { readonly card: CardView; readonly children: ReactNode }) {
  return (
    <ClientCard
      header={
        <>
          <IconHeading icon={card.isCompany ? "organization" : "person"}>{card.name}</IconHeading>
          <s-text color="subdued">{cardSubtitle(card)}</s-text>
        </>
      }
    >
      <s-stack direction="block" gap="small-100">
        {card.email === null ? <s-text color="subdued">Pas d’e-mail dans AbaNinja</s-text> : <s-text>{card.email}</s-text>}
        {card.place === null ? null : <s-text>{card.place}</s-text>}
        {card.tags.length === 0 ? null : (
          <s-stack direction="inline" gap="small-200">
            {card.tags.map((tag) => (
              <s-badge key={tag}>{tag}</s-badge>
            ))}
          </s-stack>
        )}
      </s-stack>
      {children}
    </ClientCard>
  );
}
