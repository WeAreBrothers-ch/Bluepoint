import type { ReactNode } from "react";

/**
 * Bouton compact avec une zone tactile d'au moins 44 × 44 px (pas de quantité, cartons,
 * choix d'un client). Polaris ne propose pas de taille de bouton : on passe par s-clickable.
 */

interface TouchButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  /** Occupe toute la largeur (liste de résultats). */
  readonly fill?: boolean;
}

export function TouchButton({ label, onPress, children, disabled = false, fill = false }: TouchButtonProps) {
  return (
    <s-clickable
      accessibilityLabel={label}
      onClick={onPress}
      minBlockSize="44px"
      minInlineSize="44px"
      padding="small-200 small"
      border="base"
      borderRadius="base"
      background="base"
      {...(fill ? { inlineSize: "100%" } : {})}
      {...(disabled ? { disabled: true } : {})}
    >
      <s-stack direction="inline" alignItems="center" justifyContent={fill ? "start" : "center"} blockSize="100%">
        {children}
      </s-stack>
    </s-clickable>
  );
}
