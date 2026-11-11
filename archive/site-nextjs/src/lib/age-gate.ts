/**
 * Vérification d'âge : la réponse est mémorisée dans le navigateur (localStorage).
 * Le script inline `AGE_GATE_BOOT_SCRIPT` s'exécute avant le premier affichage pour
 * que la fenêtre n'apparaisse jamais, même une fraction de seconde, chez un visiteur
 * déjà validé.
 */

export const AGE_STORAGE_KEY = "bp-age-ok";
export const AGE_ROOT_ATTRIBUTE = "data-age-ok";

/** Durée de validité de la confirmation : 30 jours. */
const AGE_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

export function isAgeConfirmed(): boolean {
  return document.documentElement.hasAttribute(AGE_ROOT_ATTRIBUTE);
}

export function rememberAgeConfirmed(now: number = Date.now()): void {
  try {
    window.localStorage.setItem(AGE_STORAGE_KEY, String(now));
  } catch {
    // Stockage indisponible : la confirmation vaut pour la page en cours uniquement.
  }
  document.documentElement.setAttribute(AGE_ROOT_ATTRIBUTE, "");
}

export const AGE_GATE_BOOT_SCRIPT = `try{var t=Number(localStorage.getItem("${AGE_STORAGE_KEY}"));if(t&&Date.now()-t<${AGE_VALIDITY_MS}){document.documentElement.setAttribute("${AGE_ROOT_ATTRIBUTE}","")}}catch(e){}`;

/** Où envoyer un visiteur qui déclare ne pas avoir l'âge légal. */
export const UNDERAGE_EXIT_URL = "https://www.addictionsuisse.ch/";
