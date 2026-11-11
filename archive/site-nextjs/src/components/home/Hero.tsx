import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FEATURED_SLUG, HERO_LINES } from "@/data/home";
import { PHOTOS } from "@/data/photos";
import { bottleHref, requireBottle } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_FROM } from "@/lib/packs";
import styles from "./Hero.module.css";

export function Hero() {
  const featured = requireBottle(FEATURED_SLUG);
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.text}>
        <p className={`ui carre ${styles.kicker}`}>Vins d&apos;Italie et de Suisse romande</p>
        <h1 id="hero-title" className={styles.title}>
          {HERO_LINES.map((line, index) => (
            <span key={line} className={styles.line}>
              <span className={styles.lineInner} style={{ animationDelay: `calc(var(--delai-intro, 0s) + ${120 + index * 90}ms)` }}>
                {line}
              </span>
            </span>
          ))}
        </h1>
        <p className={styles.lead}>
          La sélection de Paolo Pioletti, à Lutry. Il goûte chez chaque vigneron avant de vous
          proposer sa bouteille.
        </p>
        <div className={styles.actions}>
          <ButtonLink href="/bouteilles">Voir la boutique</ButtonLink>
          <ButtonLink href="/#maison" variant="trait">
            Rencontrer Paolo
          </ButtonLink>
        </div>
      </div>

      <figure className={styles.photo}>
        <Image
          src={PHOTOS.vigneron.src}
          alt={PHOTOS.vigneron.alt}
          fill
          priority
          sizes="(min-width: 56rem) 42vw, 100vw"
          className={styles.image}
        />
        <figcaption className={`ui ${styles.caption}`}>[01] {PHOTOS.vigneron.caption}</figcaption>
        <Link href={bottleHref(featured)} className={`ui ${styles.featured}`}>
          <span className={`carre ${styles.featuredLabel}`} data-actif="true">
            À la une
          </span>
          <span>{featured.name}</span>
          <span className={styles.featuredMeta}>
            {featured.producer} · {formatPrice(featured.priceCents, featured.currency)}
          </span>
        </Link>
      </figure>

      <ul className={`ui ${styles.promises}`}>
        <li className="carre">Livraison sous 48 h en Suisse</li>
        <li className="carre">Offerte dès {FREE_SHIPPING_FROM} bouteilles</li>
        <li className="carre">En direct des vignerons</li>
      </ul>
    </section>
  );
}
