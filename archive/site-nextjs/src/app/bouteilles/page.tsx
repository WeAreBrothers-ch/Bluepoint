import type { Metadata } from "next";
import { BottleGrid } from "@/components/range/BottleGrid";
import styles from "@/components/range/ShopPage.module.css";
import { SectionHead } from "@/components/ui/SectionHead";
import { getAllBottles } from "@/lib/catalog";
import { FREE_SHIPPING_FROM } from "@/lib/packs";

export const metadata: Metadata = {
  title: "Boutique | BluePoint Distribution",
  description: "Toutes les bouteilles de la sélection de Paolo, à l'unité ou en carton.",
};

export default function ShopPage() {
  const bottles = getAllBottles();
  return (
    <main className={styles.page}>
      <p className={`ui ${styles.kicker}`}>[{bottles.length}] bouteilles</p>
      <h1 className={styles.title}>La boutique</h1>
      <p className={styles.intro}>
        À l&apos;unité ou en carton de 3, 6 ou 12. Livraison sous 48 h en Suisse, offerte dès{" "}
        {FREE_SHIPPING_FROM} bouteilles.
      </p>
      <SectionHead id="boutique-title" title="Toutes les bouteilles" />
      <BottleGrid bottles={bottles} />
    </main>
  );
}
