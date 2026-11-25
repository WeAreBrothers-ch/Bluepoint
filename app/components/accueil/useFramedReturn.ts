import { useEffect, useSyncExternalStore } from "react";

/**
 * Dans l'admin Shopify, l'accueil n'a rien à montrer : on retourne tout de suite aux livraisons. Une fois par minute
 * au plus : si quelque chose ramène sans cesse ici, on s'arrête et la page garde ses boutons au lieu de tourner en rond.
 * Renvoie vrai quand la page est affichée dans l'admin Shopify (faux pendant le rendu serveur).
 */

const RETURN_KEY = "bp-accueil-retour";
export const RETURN_PAUSE_MS = 60_000;

type ReturnStorage = Pick<Storage, "getItem" | "setItem">;

function isFramed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

/** Note l'heure du retour ; faux si un retour a déjà eu lieu il y a moins d'une minute, ou si le navigateur refuse. */
export function claimReturn(readStorage: () => ReturnStorage, now: number): boolean {
  try {
    const storage = readStorage();
    const last = Number(storage.getItem(RETURN_KEY) ?? "0");
    if (now - last < RETURN_PAUSE_MS) return false;
    storage.setItem(RETURN_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

/** Être dans un cadre ne change pas pendant la vie de la page : rien à écouter. */
function noSubscription(): () => void {
  return () => undefined;
}

function notFramedOnServer(): boolean {
  return false;
}

export function useFramedReturn(returnUrl: string | null): boolean {
  const framed = useSyncExternalStore(noSubscription, isFramed, notFramedOnServer);
  useEffect(() => {
    if (framed && returnUrl !== null && claimReturn(() => window.sessionStorage, Date.now())) window.location.replace(returnUrl);
  }, [framed, returnUrl]);
  return framed;
}
