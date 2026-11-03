/**
 * Bouton sur toute la largeur de sa case. La bibliothèque Polaris chargée par Shopify le comprend
 * (`inlineSize="fill"`), mais ses types TypeScript (1.0.1) ne le connaissent pas encore : on passe par ce raccourci.
 */
export const FILL = { inlineSize: "fill" } as const;
