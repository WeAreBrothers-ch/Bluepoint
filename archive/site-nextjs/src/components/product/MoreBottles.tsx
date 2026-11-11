import { Carousel } from "@/components/carousel/Carousel";
import { ProductCard } from "@/components/product-card/ProductCard";
import { SectionHead } from "@/components/ui/SectionHead";
import { getOtherBottles } from "@/lib/catalog";
import styles from "./MoreBottles.module.css";

interface MoreBottlesProps {
  currentSlug: string;
}

/** Combien d'autres bouteilles proposer sous la fiche. */
const SUGGESTIONS = 8;

export function MoreBottles({ currentSlug }: MoreBottlesProps) {
  const others = getOtherBottles(currentSlug, SUGGESTIONS);
  if (others.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="autres-title">
      <SectionHead
        id="autres-title"
        title="À découvrir aussi"
        link={{ href: "/bouteilles", label: "Toutes les bouteilles" }}
      />
      <Carousel label="Autres bouteilles">
        {others.map((bottle) => (
          <ProductCard key={bottle.slug} bottle={bottle} sizes="(min-width: 90rem) 19vw, (min-width: 64rem) 24vw, 70vw" />
        ))}
      </Carousel>
    </section>
  );
}
