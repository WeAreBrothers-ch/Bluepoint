import type { ReactNode } from "react";
import type { ModeIcon } from "../lib/agenda/labels";

/**
 * Une icône devant le nom d'un client ou d'une entreprise. Sur un téléphone, un long nom passe à la ligne
 * à côté de l'icône, au lieu de laisser l'icône seule sur sa ligne au-dessus du nom.
 */
export function IconHeading({ icon, children }: { readonly icon: ModeIcon | "organization" | null; readonly children: ReactNode }) {
  if (icon === null) return <s-heading>{children}</s-heading>;
  return (
    <s-grid gridTemplateColumns="auto minmax(0, 1fr)" gap="small-200" alignItems="center">
      <s-icon type={icon} />
      <s-heading>{children}</s-heading>
    </s-grid>
  );
}
