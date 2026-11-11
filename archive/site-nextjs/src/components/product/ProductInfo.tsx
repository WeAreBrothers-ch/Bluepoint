import Link from "next/link";
import type { Bottle } from "@/data/types";
import { formatAbv, formatPrice, formatVolume } from "@/lib/format";
import { BuyBox } from "./BuyBox";
import { InfoAccordions } from "./InfoAccordions";
import styles from "./ProductInfo.module.css";

interface ProductInfoProps {
  bottle: Bottle;
}

export function ProductInfo({ bottle }: ProductInfoProps) {
  const facts: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Producteur", value: bottle.producer },
    { label: "Origine", value: bottle.region },
    { label: "Cépage", value: bottle.grape },
    { label: "Contenance", value: formatVolume(bottle.volumeMl) },
    { label: "Degré", value: formatAbv(bottle.abv) },
  ];
  return (
    <div className={styles.info}>
      <nav aria-label="Fil d'Ariane" className={`ui ${styles.trail}`}>
        <Link href="/bouteilles" className={`carre ${styles.trailLink}`}>
          Boutique
        </Link>
        <span aria-hidden="true">/</span>
        <span>{bottle.category}</span>
      </nav>

      <div className={styles.heading}>
        <h1 className={styles.name}>{bottle.name}</h1>
        <p className={`ui ${styles.producer}`}>
          {bottle.producer} — {bottle.region}
        </p>
      </div>

      <p className={styles.price}>{formatPrice(bottle.priceCents, bottle.currency)}</p>
      <p className={styles.description}>{bottle.description}</p>

      <BuyBox bottle={bottle} />

      <dl className={`ui ${styles.facts}`}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <dt className="crochets">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <InfoAccordions bottle={bottle} />
    </div>
  );
}
