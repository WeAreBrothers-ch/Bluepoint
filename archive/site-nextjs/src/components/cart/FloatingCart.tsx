"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCartCount } from "@/lib/cart/use-cart";
import styles from "./FloatingCart.module.css";

/** Bouton panier fixé en bas à droite, toujours à portée de pouce. */
export function FloatingCart() {
  const count = useCartCount();
  const pathname = usePathname();
  if (pathname === "/panier") return null;

  const label = count === 0 ? "Panier, vide" : `Panier, ${count} bouteille${count > 1 ? "s" : ""}`;
  return (
    <Link href="/panier" className={`ui carre ${styles.cart}`} data-actif={count > 0} aria-label={label}>
      Panier
      {/* La clé change avec le nombre : le compteur rejoue sa petite animation à chaque ajout. */}
      <span key={count} className={styles.count} aria-hidden="true">
        ({count})
      </span>
    </Link>
  );
}
