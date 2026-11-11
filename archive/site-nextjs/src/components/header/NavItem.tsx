"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalIcon } from "@/components/ui/ExternalIcon";
import { isActive, type NavLink } from "@/data/navigation";
import styles from "./SiteHeader.module.css";

interface NavItemProps {
  link: NavLink;
  /** Suffixe affiché après l'intitulé, par exemple le nombre de bouteilles. */
  count?: number;
  onNavigate?: () => void;
}

export function NavItem({ link, count, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const label = (
    <>
      {link.label}
      {count !== undefined && <span className={styles.count}>[{count}]</span>}
    </>
  );

  if (link.external) {
    return (
      <a className={`carre ${styles.link}`} href={link.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
        {label}
        <ExternalIcon className={styles.external} />
        <span className="sr-only">(nouvel onglet)</span>
      </a>
    );
  }

  return (
    <Link
      className={`carre ${styles.link}`}
      href={link.href}
      aria-current={isActive(link, pathname) ? "page" : undefined}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}
