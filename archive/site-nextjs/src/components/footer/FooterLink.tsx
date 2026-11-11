import Link from "next/link";
import { ExternalIcon } from "@/components/ui/ExternalIcon";
import type { FooterLinkData } from "@/data/footer";
import styles from "./SiteFooter.module.css";

interface FooterLinkProps {
  link: FooterLinkData;
}

/** Les adresses web externes s'ouvrent dans un nouvel onglet ; e-mail et téléphone restent sur place. */
function opensNewTab(href: string): boolean {
  return href.startsWith("http");
}

export function FooterLink({ link }: FooterLinkProps) {
  if (!link.external) {
    return (
      <Link href={link.href} className={styles.link}>
        {link.label}
      </Link>
    );
  }
  const newTab = opensNewTab(link.href);
  return (
    <a
      href={link.href}
      className={styles.link}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
    >
      <ExternalIcon className={styles.icon} />
      {link.label}
      {newTab && <span className="sr-only">(nouvel onglet)</span>}
    </a>
  );
}
