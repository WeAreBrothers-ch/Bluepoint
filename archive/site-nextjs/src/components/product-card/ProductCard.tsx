import Link from "next/link";
import { Packshot } from "@/components/packshot/Packshot";
import type { Bottle } from "@/data/types";
import { bottleHref } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { QuickAdd } from "./QuickAdd";
import styles from "./ProductCard.module.css";

interface ProductCardProps {
  bottle: Bottle;
  sizes: string;
  priority?: boolean;
}

/**
 * Tuile bouteille, puis une ligne d'étiquette : « + » pour l'ajout rapide,
 * nom et prix. La tuile et le nom mènent tous deux à la fiche.
 */
export function ProductCard({ bottle, sizes, priority = false }: ProductCardProps) {
  const href = bottleHref(bottle);
  return (
    <article className={styles.card}>
      <Link href={href} className={styles.visualLink} tabIndex={-1} aria-hidden="true">
        <Packshot bottle={bottle} sizes={sizes} priority={priority} className={styles.visual} />
      </Link>
      <div className={styles.meta}>
        <QuickAdd slug={bottle.slug} name={bottle.name} />
        <Link href={href} className={`ui ${styles.info}`}>
          <span className={styles.name}>{bottle.name}</span>
          <span className={styles.producer}>{bottle.producer}</span>
          <span>{formatPrice(bottle.priceCents, bottle.currency)}</span>
        </Link>
      </div>
    </article>
  );
}
