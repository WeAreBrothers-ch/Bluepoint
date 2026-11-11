import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { contact } from "@/data/contact";
import { FOOTER_COLUMNS } from "@/data/footer";
import { FooterLink } from "./FooterLink";
import styles from "./SiteFooter.module.css";

/** Pied de page en tableau encadré : la marque à gauche, les colonnes de liens à droite. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.box}>
        <span className={styles.joint} aria-hidden="true" />
        <div className={styles.brandCell}>
          <Link href="/" className={styles.brand} aria-label="BluePoint Distribution, accueil">
            <BrandLogo className={styles.logo} />
          </Link>
          <address className={`ui ${styles.address}`}>
            {contact.street}
            <br />
            {contact.city}
          </address>
          <p className="ui">
            {contact.company} © {year}
          </p>
        </div>

        <div className={`ui ${styles.columns}`}>
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className={styles.column} data-large={column.wide === true}>
              <h2 className={`crochets ${styles.heading}`}>{column.title}</h2>
              <ul className={styles.links}>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className={`ui ${styles.legal}`}>
        L&apos;abus d&apos;alcool est dangereux pour la santé, à consommer avec modération. Vente
        réservée aux personnes de 18&nbsp;ans et plus.
      </p>
    </footer>
  );
}
