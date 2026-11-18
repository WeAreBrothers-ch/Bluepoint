/**
 * Styles communs à toutes les pages de l'app, posés dans le <head> par `root.tsx`.
 *
 * L'app est lue et touchée par des personnes peu à l'aise avec l'informatique, souvent sur un téléphone :
 *
 * - Tout est 15 % plus grand (texte, boutons, espaces).
 * - Le gris des textes secondaires est plus foncé que celui de Shopify : il reste plus discret que le noir,
 *   mais il se lit dehors, au soleil, sur un téléphone.
 * - Le nom d'un client, d'un vin ou d'une facture (titre de carte) est plus grand que le texte : on le repère d'un coup d'œil.
 * - Sur un téléphone, tout le texte grandit encore (≈ 17 px pour le texte courant, comme les apps de l'iPhone) :
 *   la mise en page Polaris ne bouge pas, seules les lettres grossissent. Les champs passent ainsi au-dessus de 16 px,
 *   ce qui empêche l'iPhone de zoomer toute la page quand on touche un champ.
 * - Le téléphone ne grossit pas le texte tout seul quand on le tourne, et un double toucher sur un bouton ne zoome pas.
 *
 * Polaris lit ses tailles dans des variables `--p-…-f4125` (avec une valeur par défaut) : on les fixe ici.
 * Si Polaris les renomme un jour, rien ne casse : l'app reprend simplement les tailles de Shopify.
 * La règle « téléphone » est celle de Polaris : écran tactile et moins de 48 rem de large.
 */

const ALL_SCREENS = [
  // Gris secondaire : rgb(97, 97, 97) chez Shopify.
  "--p-color-text-secondary-f4125:rgba(74,74,74,1)",
  // Titres de carte : 13 px chez Shopify, comme le texte.
  "--p-font-size-heading-medium-f4125:0.9375rem",
  "--p-font-line-height-heading-medium-f4125:1.375rem",
  // Pastille « Client pro » / « Particulier » (ClientKindBadge).
  "--bp-pill-font-size:0.8125rem",
].join(";");

const PHONE = [
  "--p-font-size-body-medium-f4125:0.9375rem",
  "--p-font-line-height-body-medium-f4125:1.375rem",
  "--p-font-size-body-large-f4125:1rem",
  "--p-font-line-height-body-large-f4125:1.375rem",
  "--p-font-size-body-small-f4125:0.84375rem",
  "--p-font-line-height-body-small-f4125:1.1875rem",
  "--p-font-size-body-x-small-f4125:0.75rem",
  "--p-font-line-height-body-x-small-f4125:1rem",
  "--p-font-size-heading-small-f4125:0.875rem",
  "--p-font-size-heading-medium-f4125:1.0625rem",
  "--p-font-line-height-heading-medium-f4125:1.5rem",
  "--p-font-size-heading-large-f4125:1.125rem",
  "--p-font-line-height-heading-large-f4125:1.5rem",
  "--p-font-size-button-label-f4125:0.875rem",
  "--p-font-line-height-button-label-f4125:1.25rem",
  "--p-font-size-input-label-f4125:0.9375rem",
  "--p-font-line-height-input-label-f4125:1.375rem",
  "--p-font-size-input-label-small-f4125:0.84375rem",
  "--p-font-size-input-value-f4125:0.9375rem",
  "--p-font-size-details-text-f4125:0.84375rem",
  "--bp-pill-font-size:0.9375rem",
].join(";");

export const APP_STYLE = [
  "html{-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:manipulation}",
  "body{zoom:1.15}",
  `:root{${ALL_SCREENS}}`,
  `@media (pointer:coarse) and (max-width:47.9975em){:root{${PHONE}}}`,
].join("\n");
