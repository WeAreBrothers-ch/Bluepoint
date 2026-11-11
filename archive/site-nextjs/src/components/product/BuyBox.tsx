"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Bottle } from "@/data/types";
import { addToCart } from "@/lib/cart/store";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_FROM, packPriceCents, type PackSize } from "@/lib/packs";
import { PackSelector } from "./PackSelector";
import styles from "./BuyBox.module.css";

interface BuyBoxProps {
  bottle: Bottle;
}

const CONFIRMATION_MS = 2600;

const noSubscription = (): (() => void) => () => undefined;

/** Vrai seulement dans le navigateur : la barre fixe y est rattachée directement au <body>. */
function useIsBrowser(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/**
 * Choix du format et ajout au panier. Quand le bouton principal sort de l'écran,
 * une barre d'achat fixe prend le relais : l'action reste toujours à portée.
 */
export function BuyBox({ bottle }: BuyBoxProps) {
  const [pack, setPack] = useState<PackSize>(1);
  const [added, setAdded] = useState<number | null>(null);
  const [barVisible, setBarVisible] = useState<boolean>(false);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const isBrowser = useIsBrowser();

  useEffect(() => {
    const button = mainButtonRef.current;
    if (!button || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setBarVisible(!entry?.isIntersecting));
    observer.observe(button);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (added === null) return;
    const timer = window.setTimeout(() => setAdded(null), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [added]);

  const price = formatPrice(packPriceCents(bottle, pack), bottle.currency);
  const add = (): void => {
    addToCart(bottle.slug, pack);
    setAdded(pack);
  };
  const buttonText = added === null ? "Ajouter au panier" : "Ajouté au panier";

  /*
   * La barre est « téléportée » dans le <body> : une animation sur une colonne parente
   * (translate, transform) la piégerait sinon dans cette colonne au lieu du bas de l'écran.
   */
  const bar = (
    <div
      className={styles.bar}
      data-visible={barVisible}
      data-barre-achat={barVisible ? "visible" : "masquee"}
      aria-hidden={!barVisible}
      inert={!barVisible}
    >
      <p className={`ui ${styles.barName}`}>
        <span className={styles.barTitle}>{bottle.name}</span>
        <span className={styles.barPrice}>{price}</span>
      </p>
      <button type="button" className={`ui carre ${styles.barAdd}`} data-actif={added !== null} onClick={add}>
        {added === null ? "Ajouter" : "Ajouté"}
      </button>
    </div>
  );

  return (
    <div className={styles.box}>
      <PackSelector bottle={bottle} value={pack} onChange={setPack} />
      <button
        ref={mainButtonRef}
        type="button"
        className={`ui carre ${styles.add}`}
        data-actif={added !== null}
        onClick={add}
      >
        <span className={styles.addLabel}>{buttonText}</span>
        <span>{price}</span>
      </button>
      <p className={styles.status} role="status">
        {added !== null ? (
          <>
            {added} bouteille{added > 1 ? "s" : ""} ajoutée{added > 1 ? "s" : ""}.{" "}
            <Link href="/panier" className={styles.statusLink}>
              Voir le panier
            </Link>
          </>
        ) : (
          `Livraison sous 48 h. Offerte dès ${FREE_SHIPPING_FROM} bouteilles.`
        )}
      </p>

      {isBrowser && createPortal(bar, document.body)}
    </div>
  );
}
