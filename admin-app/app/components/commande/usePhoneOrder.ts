import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useFetcher } from "react-router";
import { toLines } from "../../lib/commande/cart";
import { formReducer, initialFormState, toPriceRequest, toSubmission } from "../../lib/commande/form-state";
import type { PriceCalculationResult } from "../../lib/commande/pricing";
import type { VariantGid } from "../../lib/commande/types";
import type { CommandeActionResult } from "../../lib/commande/action.server";
import type { IsoDate } from "../../lib/metafields/definitions";
import { useDebouncedValue } from "../useDebouncedValue";

/**
 * État du formulaire « Nouvelle commande » et calcul des prix B2B.
 * Anti-doublon : une clé par version du formulaire. Tant que rien n'est modifié, un nouvel
 * envoi (double clic, nouvel essai après erreur) réutilise la même clé ; le serveur ne crée
 * alors jamais une deuxième commande.
 */

const PRICE_DELAY_MS = 500;

export type Submission = ReturnType<typeof toSubmission>;

function newKey(): string {
  return crypto.randomUUID();
}

export function usePhoneOrder(today: IsoDate, onSubmit: (submission: Submission) => void) {
  const [state, dispatch] = useReducer(formReducer, today, initialFormState);
  const keyRef = useRef<string | null>(null);
  const priceFetcher = useFetcher<CommandeActionResult>({ key: "commande-prix" });

  // Nouvelle clé à chaque modification du formulaire (un effet ne tourne jamais côté serveur).
  useEffect(() => {
    keyRef.current = newKey();
  }, [state]);

  const priceRequest = useMemo(() => toPriceRequest(state), [state]);
  const signature = priceRequest === null ? null : JSON.stringify(priceRequest);
  const debouncedSignature = useDebouncedValue(signature, PRICE_DELAY_MS);
  const lastSubmitted = useRef<string | null>(null);
  const { submit: submitPrices } = priceFetcher;

  useEffect(() => {
    if (debouncedSignature === null || debouncedSignature === lastSubmitted.current || priceRequest === null) return;
    if (JSON.stringify(priceRequest) !== debouncedSignature) return;
    lastSubmitted.current = debouncedSignature;
    submitPrices({ ...priceRequest, signature: debouncedSignature }, { method: "post", encType: "application/json" });
  }, [debouncedSignature, priceRequest, submitPrices]);

  const data = priceFetcher.data;
  // Prix valables seulement pour la commande telle qu'elle est affichée (le serveur renvoie la signature).
  const priceResult: PriceCalculationResult | null =
    data?.intent === "calculer" && signature !== null && data.signature === signature ? data.result : null;

  const submit = useCallback(() => {
    const key = keyRef.current ?? newKey();
    keyRef.current = key;
    onSubmit(toSubmission(state, key));
  }, [state, onSubmit]);

  const setQuantity = useCallback(
    (variantId: VariantGid, quantity: number) => dispatch({ type: "quantite", variantId, quantity }),
    [],
  );
  const addQuantity = useCallback(
    (variantId: VariantGid, delta: number) => dispatch({ type: "ajouter", variantId, delta }),
    [],
  );

  return {
    state,
    dispatch,
    lines: useMemo(() => toLines(state.quantities), [state.quantities]),
    setQuantity,
    addQuantity,
    submit,
    priceResult,
    pricing: signature !== null && priceResult === null,
  };
}
