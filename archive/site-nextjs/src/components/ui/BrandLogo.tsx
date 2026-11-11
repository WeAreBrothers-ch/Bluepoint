import styles from "./BrandLogo.module.css";

interface BrandLogoProps {
  className?: string;
}

/**
 * Logo horizontal du client (vectoriel), peint en masque CSS : il prend la couleur
 * du texte qui l'entoure. Décoratif : le lien parent porte le nom de la marque.
 */
export function BrandLogo({ className }: BrandLogoProps) {
  return <span className={[styles.logo, className].filter(Boolean).join(" ")} aria-hidden="true" />;
}
