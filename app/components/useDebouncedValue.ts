import { useEffect, useState } from "react";

/** Valeur qui ne change qu'après `delayMs` sans nouvelle saisie (recherche, calcul de prix). */
export function useDebouncedValue<TValue>(value: TValue, delayMs: number): TValue {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
