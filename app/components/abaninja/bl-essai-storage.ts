import { useMemo, useSyncExternalStore } from "react";
import { readTrialDocuments } from "../../lib/abaninja/bl-essai-form";
import type { TrialDocuments } from "../../lib/abaninja/bl-essai-types";

/**
 * Garde l'essai en cours dans l'onglet (sessionStorage), pour pouvoir tout effacer même après
 * être passé sur une autre page de l'app. Simple confort : si le navigateur refuse le stockage,
 * la page marche quand même, et chaque document reste retrouvable par sa référence BP-ESSAI-BL-….
 */

const STORAGE_KEY = "bluepoint-essai-bon-livraison";

/** Rien à écouter : la page relit le stockage à chaque rendu, et c'est elle seule qui l'écrit. */
function subscribe(): () => void {
  return () => undefined;
}

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Stockage refusé : on repart sans essai en mémoire.
    return null;
  }
}

function parse(raw: string | null): TrialDocuments | null {
  if (raw === null) return null;
  try {
    return readTrialDocuments(JSON.parse(raw));
  } catch {
    // Contenu abîmé : on l'ignore.
    return null;
  }
}

/** Essai gardé dans l'onglet ; null côté serveur et au premier affichage. */
export function useStoredTrial(): TrialDocuments | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parse(raw), [raw]);
}

export function storeTrial(documents: TrialDocuments | null): void {
  try {
    if (documents === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch {
    // Stockage refusé (navigation privée, réglages) : la page garde l'essai tant qu'elle reste ouverte.
  }
}
