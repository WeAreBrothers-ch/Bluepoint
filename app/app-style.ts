/**
 * Styles communs à toutes les pages de l'app, posés dans le <head> par `root.tsx`.
 *
 * - Texte et boutons 15 % plus grands : l'application est lue et touchée par des personnes peu à l'aise avec l'informatique.
 * - Le téléphone ne grossit pas le texte tout seul quand on le tourne, et un double toucher sur un bouton ne zoome pas.
 * - Sur un téléphone, le texte tapé dans les champs est un peu plus grand (15 px × 1,15 ≈ 17 px) : au-dessous de 16 px,
 *   l'iPhone zoome toute la page dès qu'on touche un champ, et il faut ensuite la dézoomer à deux doigts.
 *   Les champs Polaris lisent leur taille dans la variable `--p-font-size-body-medium-…` : on la change pour eux seuls.
 *   Si Polaris renomme un jour cette variable, rien ne casse : l'iPhone zoomera simplement de nouveau.
 *   La règle « téléphone » est celle de Polaris : écran tactile et moins de 48 rem de large.
 */
const FIELDS = [
  "s-search-field",
  "s-text-field",
  "s-text-area",
  "s-number-field",
  "s-date-field",
  "s-email-field",
  "s-password-field",
  "s-url-field",
  "s-money-field",
  "s-select",
].join(",");

export const APP_STYLE = [
  "html{-webkit-text-size-adjust:100%;text-size-adjust:100%;touch-action:manipulation}",
  "body{zoom:1.15}",
  `@media (pointer:coarse) and (max-width:47.9975em){${FIELDS}{--p-font-size-body-medium-f4125:15px}}`,
].join("\n");
