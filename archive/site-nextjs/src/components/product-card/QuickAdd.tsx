"use client";

import { useEffect, useState } from "react";
import { addToCart } from "@/lib/cart/store";
import styles from "./ProductCard.module.css";

interface QuickAddProps {
  slug: string;
  name: string;
}

const CONFIRMATION_MS = 1600;

/** Le « + » sous la tuile : ajoute une bouteille sans quitter la page. */
export function QuickAdd({ slug, name }: QuickAddProps) {
  const [added, setAdded] = useState<boolean>(false);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [added]);

  const add = (): void => {
    addToCart(slug, 1);
    setAdded(true);
  };

  return (
    <>
      <button
        type="button"
        className={styles.quickAdd}
        data-ajoute={added}
        onClick={add}
        aria-label={`Ajouter une bouteille de ${name} au panier`}
      >
        <svg viewBox="0 0 14 14" aria-hidden="true">
          <path className={styles.plus} d="M7 1v12M1 7h12" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path className={styles.check} d="M1.5 7.5 5.5 11 12.5 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <span className="sr-only" role="status">
        {added ? `${name} ajouté au panier.` : ""}
      </span>
    </>
  );
}
