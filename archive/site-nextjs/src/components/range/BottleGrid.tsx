import { ProductCard } from "@/components/product-card/ProductCard";
import type { Bottle } from "@/data/types";
import styles from "./BottleGrid.module.css";

interface BottleGridProps {
  bottles: ReadonlyArray<Bottle>;
}

export function BottleGrid({ bottles }: BottleGridProps) {
  if (bottles.length === 0) {
    return (
      <p className={styles.empty}>
        La nouvelle sélection arrive. Écrivez-nous en attendant, Paolo vous conseille.
      </p>
    );
  }
  return (
    <ul className={styles.grid}>
      {bottles.map((bottle, index) => (
        <li key={bottle.slug} className="apparition">
          <ProductCard
            bottle={bottle}
            sizes="(min-width: 90rem) 19vw, (min-width: 64rem) 24vw, (min-width: 40rem) 32vw, 48vw"
            priority={index < 2}
          />
        </li>
      ))}
    </ul>
  );
}
