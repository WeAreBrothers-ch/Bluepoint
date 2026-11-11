/**
 * Intro animée de l'accueil (Paolo qui déguste). Jouée une fois par visite :
 * le souvenir est gardé le temps de l'onglet (sessionStorage).
 * Le script inline `INTRO_BOOT_SCRIPT` s'exécute avant le premier affichage pour
 * qu'un visiteur qui l'a déjà vue (ou qui limite les animations) ne la voie jamais clignoter.
 */

export const INTRO_STORAGE_KEY = "bp-intro-vue";
export const INTRO_ROOT_ATTRIBUTE = "data-intro-vue";

/** Paramètre d'adresse qui force la relecture (démo client) : localhost:3000/?intro */
export const INTRO_REPLAY_PARAM = "intro";

export const INTRO_BOOT_SCRIPT = `try{if(new URLSearchParams(location.search).has("${INTRO_REPLAY_PARAM}")){sessionStorage.removeItem("${INTRO_STORAGE_KEY}")}else if(sessionStorage.getItem("${INTRO_STORAGE_KEY}")||matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("${INTRO_ROOT_ATTRIBUTE}","")}}catch(e){document.documentElement.setAttribute("${INTRO_ROOT_ATTRIBUTE}","")}`;

export function markIntroSeen(): void {
  try {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
  } catch {
    // Stockage indisponible : l'intro pourra se rejouer au prochain chargement, sans gravité.
  }
  document.documentElement.setAttribute(INTRO_ROOT_ATTRIBUTE, "");
}
