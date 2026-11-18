import type { ComponentProps } from "react";
import { FILL } from "./fill";

/**
 * Lien vers une page qui n'est plus dans le menu, posé en bas de la page où on la cherche
 * (« Litres vendus » en bas de « Stock », « Informations de l'entreprise » en bas de « Factures »).
 * Le même lien est aussi en haut, dans les boutons de la page (« … » sur un téléphone).
 */
export function PageLink({ href, icon, children }: { readonly href: string; readonly icon: ComponentProps<"s-button">["icon"]; readonly children: string }) {
  return (
    <s-section>
      <s-grid gridTemplateColumns="minmax(0, 1fr)">
        <s-button {...FILL} icon={icon} href={href}>
          {children}
        </s-button>
      </s-grid>
    </s-section>
  );
}
