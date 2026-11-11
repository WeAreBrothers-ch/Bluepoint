import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./ButtonLink.module.css";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  /** « plein » : bloc encre. « trait » : simple lien avec carré. */
  variant?: "plein" | "trait";
  /** Précise la destination pour les lecteurs d'écran quand le texte seul est ambigu. */
  label?: string;
}

export function ButtonLink({ href, children, variant = "plein", label }: ButtonLinkProps) {
  return (
    <Link href={href} className={`ui carre ${styles.button}`} data-variant={variant} aria-label={label}>
      {children}
    </Link>
  );
}
