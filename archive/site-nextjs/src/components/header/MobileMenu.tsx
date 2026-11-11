"use client";

import { useRef } from "react";
import { NAV_COLUMNS, type NavLink } from "@/data/navigation";
import { NavItem } from "./NavItem";
import styles from "./MobileMenu.module.css";

interface MobileMenuProps {
  bottleCount: number;
}

function countFor(link: NavLink, bottleCount: number): number | undefined {
  return link.activePath === "/bouteilles" ? bottleCount : undefined;
}

/**
 * Menu plein écran sur mobile. Fenêtre native (<dialog>) : le fond devient inerte,
 * le focus reste dedans et la touche Échap la ferme sans script supplémentaire.
 */
export function MobileMenu({ bottleCount }: MobileMenuProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = (): void => dialogRef.current?.showModal();
  const close = (): void => dialogRef.current?.close();
  const links = NAV_COLUMNS.flat();

  return (
    <>
      <button type="button" className={`ui carre ${styles.toggle}`} onClick={open} aria-haspopup="dialog">
        Menu
      </button>
      <dialog ref={dialogRef} className={styles.panel} aria-label="Menu">
        <div className={styles.top}>
          <span className="ui">BluePoint Distribution</span>
          <button type="button" className={`ui carre ${styles.close}`} onClick={close}>
            Fermer
          </button>
        </div>
        <ul className={styles.list}>
          {links.map((link, index) => (
            <li key={link.href} className={styles.item} style={{ animationDelay: `${60 + index * 45}ms` }}>
              <span className={`ui ${styles.index}`}>{String(index + 1).padStart(2, "0")}</span>
              <NavItem link={link} count={countFor(link, bottleCount)} onNavigate={close} />
            </li>
          ))}
        </ul>
        <p className={`ui ${styles.note}`}>Livraison sous 48 h en Suisse</p>
      </dialog>
    </>
  );
}
