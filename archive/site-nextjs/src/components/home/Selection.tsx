import { Carousel } from "@/components/carousel/Carousel";
import { ProductCard } from "@/components/product-card/ProductCard";
import { SectionHead } from "@/components/ui/SectionHead";
import { getAllBottles } from "@/lib/catalog";
import styles from "./Selection.module.css";

export function Selection() {
  return (
    <section id="selection" className={styles.section} aria-labelledby="selection-title">
      <SectionHead
        id="selection-title"
        title="La sélection"
        link={{ href: "/bouteilles", label: "Toutes les bouteilles" }}
      />
      <Carousel label="Bouteilles de la sélection">
        {getAllBottles().map((bottle) => (
          <ProductCard key={bottle.slug} bottle={bottle} sizes="(min-width: 90rem) 19vw, (min-width: 64rem) 24vw, 70vw" />
        ))}
      </Carousel>
    </section>
  );
}
