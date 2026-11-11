import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { NAV_COLUMNS, type NavLink } from "@/data/navigation";
import { getAllBottles } from "@/lib/catalog";
import { MobileMenu } from "./MobileMenu";
import { NavItem } from "./NavItem";
import styles from "./SiteHeader.module.css";

/** Le nombre de bouteilles s'affiche à côté de « Boutique », comme un inventaire. */
function countFor(link: NavLink, bottleCount: number): number | undefined {
  return link.activePath === "/bouteilles" ? bottleCount : undefined;
}

/**
 * En-tête fixe, en mode « différence » : noir sur le blanc, blanc sur les photos,
 * toujours lisible sans fond ni ombre.
 */
export function SiteHeader() {
  const bottleCount = getAllBottles().length;
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="BluePoint Distribution, accueil">
        <BrandLogo className={styles.logo} />
      </Link>

      <nav aria-label="Navigation principale" className={`ui ${styles.nav}`}>
        {NAV_COLUMNS.map((column, index) => (
          <ul key={index} className={styles.column}>
            {column.map((link) => (
              <li key={link.href}>
                <NavItem link={link} count={countFor(link, bottleCount)} />
              </li>
            ))}
          </ul>
        ))}
      </nav>

      <MobileMenu bottleCount={bottleCount} />
    </header>
  );
}
