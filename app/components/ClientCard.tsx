import type { ReactNode } from "react";

/**
 * Une carte = un client (ou une facture, ou un vin) : un bandeau gris avec son nom, puis le détail sur fond blanc.
 * Le bandeau est ce qui sépare nettement un client du suivant quand on fait défiler la page.
 */
interface ClientCardProps {
  /** Nom, montant, état : tout ce qu'on lit d'un coup d'œil. */
  readonly header: ReactNode;
  readonly children: ReactNode;
  /** Pour un lien direct vers la carte (ex. `#facture-…`). */
  readonly id?: string;
}

export function ClientCard({ header, children, id }: ClientCardProps) {
  return (
    <s-section padding="none" {...(id === undefined ? {} : { id })}>
      <s-box padding="base" background="subdued">
        <s-stack direction="block" gap="small-200">
          {header}
        </s-stack>
      </s-box>
      <s-divider />
      <s-box padding="base">
        <s-stack direction="block" gap="base">
          {children}
        </s-stack>
      </s-box>
    </s-section>
  );
}
