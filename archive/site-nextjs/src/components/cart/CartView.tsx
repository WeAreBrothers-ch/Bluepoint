"use client";

import { ButtonLink } from "@/components/ui/ButtonLink";
import { getBottleBySlug } from "@/lib/catalog";
import { orderMailto, totalCents, type ResolvedLine } from "@/lib/cart/order-email";
import { useCart } from "@/lib/cart/use-cart";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_FROM } from "@/lib/packs";
import { CartLineRow } from "./CartLineRow";
import styles from "./CartView.module.css";

export function CartView() {
  const lines = useCart();
  const resolved: ResolvedLine[] = lines.flatMap((line) => {
    const bottle = getBottleBySlug(line.slug);
    return bottle ? [{ bottle, quantity: line.quantity }] : [];
  });
  const count = resolved.reduce((sum, line) => sum + line.quantity, 0);
  const missing = Math.max(0, FREE_SHIPPING_FROM - count);

  if (resolved.length === 0) {
    return (
      <section className={styles.empty} aria-labelledby="panier-title">
        <p className="ui crochets">0 bouteille</p>
        <h1 id="panier-title" className={styles.title}>
          Panier vide
        </h1>
        <p className={styles.muted}>Choisissez une bouteille, à l&apos;unité ou en carton.</p>
        <ButtonLink href="/bouteilles">Voir la boutique</ButtonLink>
      </section>
    );
  }

  return (
    <section className={styles.cart} aria-labelledby="panier-title">
      <h1 id="panier-title" className={styles.title}>
        Panier
      </h1>
      <div className={styles.layout}>
        <ul className={styles.lines}>
          {resolved.map((line) => (
            <CartLineRow key={line.bottle.slug} line={line} />
          ))}
        </ul>
        <div className={styles.summary}>
          <p className={`ui ${styles.total}`}>
            <span>Total ({count})</span>
            <span>{formatPrice(totalCents(resolved), "CHF")}</span>
          </p>
          <p className="ui carre" data-actif={missing === 0}>
            {missing === 0
              ? "Livraison offerte"
              : `Encore ${missing} bouteille${missing > 1 ? "s" : ""} pour la livraison offerte`}
          </p>
          <p className={styles.muted}>
            La boutique en ligne ouvre bientôt. Votre commande est envoyée à Paolo par e-mail ; il
            vous confirme la livraison et le paiement.
          </p>
          <ButtonLink href={orderMailto(resolved)}>Envoyer ma commande</ButtonLink>
        </div>
      </div>
    </section>
  );
}
