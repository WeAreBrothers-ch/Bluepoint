"use client";

import Link from "next/link";
import { Packshot } from "@/components/packshot/Packshot";
import { setQuantity } from "@/lib/cart/store";
import type { ResolvedLine } from "@/lib/cart/order-email";
import { bottleHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import styles from "./CartView.module.css";

interface CartLineRowProps {
  line: ResolvedLine;
}

export function CartLineRow({ line }: CartLineRowProps) {
  const { bottle, quantity } = line;
  return (
    <li className={styles.line}>
      <Link href={bottleHref(bottle)} className={styles.thumb} tabIndex={-1} aria-hidden="true">
        <Packshot bottle={bottle} sizes="6rem" />
      </Link>
      <div className={styles.lineText}>
        <Link href={bottleHref(bottle)} className={`ui ${styles.lineName}`}>
          {bottle.name}
        </Link>
        <span className={`ui ${styles.muted}`}>{bottle.producer}</span>
        <div className={styles.stepper} role="group" aria-label={`Quantité de ${bottle.name}`}>
          <button type="button" onClick={() => setQuantity(bottle.slug, quantity - 1)} aria-label="Retirer une bouteille">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 6h10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <span aria-live="polite">{quantity}</span>
          <button type="button" onClick={() => setQuantity(bottle.slug, quantity + 1)} aria-label="Ajouter une bouteille">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 6h10M6 1v10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
      <span className="ui">{formatPrice(bottle.priceCents * quantity, bottle.currency)}</span>
    </li>
  );
}
