import type { ReactNode } from "react";

/**
 * Boutons d'une décision (« Oui, … » / « Non, … », « Enregistrer » / « Annuler »).
 * Sur un téléphone : l'un sous l'autre, sur toute la largeur, faciles à toucher avec le pouce et sans risque
 * de toucher le mauvais. Sur un écran large : côte à côte. Chaque bouton reçoit `{...FILL}`.
 */
export const CHOICE_GRID = "@container (inline-size > 460px) 1fr 1fr, 1fr";

export function ChoiceButtons({ children }: { readonly children: ReactNode }) {
  // La largeur mesurée est celle de `s-query-container` (sans lui, la règle « @container » ne s'applique jamais).
  return (
    <s-query-container>
      <s-grid gridTemplateColumns={CHOICE_GRID} gap="small-200">
        {children}
      </s-grid>
    </s-query-container>
  );
}
