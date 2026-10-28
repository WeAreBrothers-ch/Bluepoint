import { useEffect } from "react";

/**
 * Affiche un toast App Bridge une seule fois par réponse d'action.
 * Les fetchers nommés gardent leur réponse quand une carte change de liste (et se remonte) :
 * sans ce garde-fou, le même toast réapparaîtrait.
 */

const shown = new WeakSet<object>();

export function useToastOnce(result: object | undefined, message: string | null, isError = false): void {
  useEffect(() => {
    if (result === undefined || message === null || shown.has(result)) return;
    shown.add(result);
    shopify.toast.show(message, { isError });
  }, [result, message, isError]);
}
