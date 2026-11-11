import { contact } from "./contact";

export interface NavLink {
  href: string;
  label: string;
  /** Lien vers un autre site : ouvert dans un nouvel onglet, marqué d'une flèche. */
  external?: boolean;
  /** Chemin qui rend le lien « actif » (carré bleu). */
  activePath?: string;
}

/** Navigation principale, rangée en colonnes de deux comme une étiquette. */
export const NAV_COLUMNS: ReadonlyArray<ReadonlyArray<NavLink>> = [
  [
    { href: "/bouteilles", label: "Boutique", activePath: "/bouteilles" },
    { href: "/#accords", label: "Accords" },
  ],
  [
    { href: "/#maison", label: "La maison" },
    { href: "#contact", label: "Contact" },
  ],
  [
    { href: contact.wineBar, label: "Wine bar", external: true },
    { href: contact.instagram, label: "Instagram", external: true },
  ],
];

export function isActive(link: NavLink, pathname: string): boolean {
  return link.activePath !== undefined && pathname.startsWith(link.activePath);
}
