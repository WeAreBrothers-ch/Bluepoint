import Link from "next/link";
import { Packshot } from "@/components/packshot/Packshot";
import { SectionHead } from "@/components/ui/SectionHead";
import { momentTiles } from "@/data/home";
import { bottleHref, requireBottle } from "@/lib/catalog";
import styles from "./TableMoments.module.css";

export function TableMoments() {
  return (
    <section id="accords" className={styles.section} aria-labelledby="moments-title">
      <SectionHead id="moments-title" title="À chaque moment de la table" />
      <ol className={styles.list}>
        {momentTiles.map((tile, index) => {
          const bottle = requireBottle(tile.bottleSlug);
          return (
            <li key={tile.moment} className="apparition">
              <Link href={bottleHref(bottle)} className={styles.link}>
                <span className={`ui ${styles.index}`}>
                  <span className="crochets">{String(index + 1).padStart(2, "0")}</span>
                  <span>{tile.moment}</span>
                </span>
                <Packshot bottle={bottle} sizes="(min-width: 48rem) 30vw, 90vw" className={styles.visual} />
                <span className={styles.title}>{tile.title}</span>
                <span className={styles.dishes}>{tile.dishes}</span>
                <span className={`ui carre ${styles.bottle}`}>{bottle.name}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
