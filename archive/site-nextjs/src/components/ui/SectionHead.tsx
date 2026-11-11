import Link from "next/link";
import styles from "./SectionHead.module.css";

interface SectionHeadProps {
  id: string;
  title: string;
  /** Niveau du titre : h1 sur une page dont c'est le sujet, h2 sinon. */
  as?: "h1" | "h2";
  link?: { href: string; label: string };
}

/** Ligne d'en-tête de section : « ■ TITRE » à gauche, un lien « … + » à droite. */
export function SectionHead({ id, title, as: Heading = "h2", link }: SectionHeadProps) {
  return (
    <div className={`ui ${styles.head}`}>
      <Heading id={id} className={`carre ${styles.title}`}>
        {title}
      </Heading>
      {link && (
        <Link href={link.href} className={styles.link}>
          {link.label}
          <svg viewBox="0 0 12 12" aria-hidden="true" className={styles.plus}>
            <path d="M6 1v10M1 6h10" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </Link>
      )}
    </div>
  );
}
