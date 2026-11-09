import type { ReactNode } from "react";
import { KIND_COLORS, type ClientKind } from "./ClientKindBadge";

/**
 * Une carte = un client (ou une facture, ou un vin) : un bandeau avec son nom, puis le détail sur fond blanc.
 * Le bandeau est ce qui sépare nettement un client du suivant quand on fait défiler la page.
 * Pour un client, il prend sa couleur : bleu pour un pro, rose pour un particulier.
 */
interface ClientCardProps {
  /** Nom, montant, état : tout ce qu'on lit d'un coup d'œil. */
  readonly header: ReactNode;
  readonly children: ReactNode;
  /** Pour un lien direct vers la carte (ex. `#facture-…`). */
  readonly id?: string;
  /** Pro ou particulier : colore le bandeau. Sans valeur, le bandeau reste gris. */
  readonly kind?: ClientKind;
}

export function ClientCard({ header, children, id, kind }: ClientCardProps) {
  const colors = kind === undefined ? null : KIND_COLORS[kind];
  const bandStyle =
    colors === null ? undefined : { background: colors.tint, borderInlineStart: `0.375rem solid ${colors.accent}` };
  return (
    <s-section padding="none" {...(id === undefined ? {} : { id })}>
      <div style={bandStyle}>
        <s-box padding="base" {...(colors === null ? { background: "subdued" as const } : {})}>
          <s-stack direction="block" gap="small-200">
            {header}
          </s-stack>
        </s-box>
      </div>
      <s-divider />
      <s-box padding="base">
        <s-stack direction="block" gap="base">
          {children}
        </s-stack>
      </s-box>
    </s-section>
  );
}
