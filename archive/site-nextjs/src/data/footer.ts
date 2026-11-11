import { contact } from "./contact";

export interface FooterLinkData {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: ReadonlyArray<FooterLinkData>;
  /** Colonne élargie (adresses e-mail longues). */
  wide?: boolean;
}

export const FOOTER_COLUMNS: ReadonlyArray<FooterColumn> = [
  {
    title: "Boutique",
    links: [
      { label: "Toutes les bouteilles", href: "/bouteilles" },
      { label: "Accords", href: "/#accords" },
      { label: "Panier", href: "/panier" },
    ],
  },
  {
    title: "Maison",
    links: [
      { label: "À propos", href: "/#maison" },
      { label: "Vintage Wine Bar", href: contact.wineBar, external: true },
    ],
  },
  {
    title: "Contact",
    wide: true,
    links: [
      { label: contact.email, href: `mailto:${contact.email}`, external: true },
      { label: contact.phoneDisplay, href: contact.phoneHref, external: true },
    ],
  },
  {
    title: "Suivre",
    links: [
      { label: "Instagram", href: contact.instagram, external: true },
      { label: "Facebook", href: contact.facebook, external: true },
    ],
  },
];
