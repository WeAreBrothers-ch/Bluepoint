import type { Bottle } from "@/data/types";
import { FREE_SHIPPING_FROM } from "@/lib/packs";
import styles from "./InfoAccordions.module.css";

interface InfoAccordionsProps {
  bottle: Bottle;
}

interface InfoBlock {
  title: string;
  body: string;
}

function blocksFor(bottle: Bottle): ReadonlyArray<InfoBlock> {
  return [
    { title: "Dégustation", body: bottle.story.tasting },
    { title: "Le domaine", body: bottle.story.producer },
    { title: "Service", body: bottle.story.serving },
    { title: "Conservation", body: bottle.story.storage },
    {
      title: "Livraison",
      body: `Livraison sous 48 h en Suisse, offerte dès ${FREE_SHIPPING_FROM} bouteilles. La boutique en ligne ouvre bientôt : en attendant, votre panier nous est envoyé par e-mail et Paolo confirme la commande.`,
    },
  ];
}

/** Blocs dépliables natifs : clavier et lecteurs d'écran fonctionnent sans script. */
export function InfoAccordions({ bottle }: InfoAccordionsProps) {
  return (
    <div className={styles.list}>
      {blocksFor(bottle).map((block, index) => (
        <details key={block.title} className={styles.item} open={index === 0}>
          <summary className={`ui ${styles.summary}`}>
            {block.title}
            <span className={styles.icon} aria-hidden="true" />
          </summary>
          <p className={styles.body}>{block.body}</p>
        </details>
      ))}
    </div>
  );
}
