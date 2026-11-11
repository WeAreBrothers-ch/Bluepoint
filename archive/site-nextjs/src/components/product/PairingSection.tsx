import type { Bottle } from "@/data/types";
import { SectionHead } from "@/components/ui/SectionHead";
import styles from "./PairingSection.module.css";

interface PairingSectionProps {
  bottle: Bottle;
}

export function PairingSection({ bottle }: PairingSectionProps) {
  return (
    <section className={styles.section} aria-labelledby="accords-title">
      <SectionHead id="accords-title" title="De l'apéritif au dessert" />
      <p className={styles.intro}>
        Trois moments de la table où {bottle.name} trouve sa place, choisis par Paolo.
      </p>
      <ol className={styles.list}>
        {bottle.story.pairings.map((pairing, index) => (
          <li key={pairing.moment} className={`apparition ${styles.item}`}>
            <p className={`ui ${styles.moment}`}>
              <span className="crochets">{String(index + 1).padStart(2, "0")}</span>
              <span>{pairing.moment}</span>
            </p>
            <h3 className={styles.dish}>{pairing.dish}</h3>
            <p className={styles.why}>{pairing.why}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
