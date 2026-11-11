/**
 * Photos d'ambiance du site (hors bouteilles du catalogue).
 *
 * ⚠ PROVISOIRE : photos fournies pour la maquette le 13/10/2026, sans droits vérifiés.
 * Plusieurs montrent les étiquettes d'autres marques : à remplacer par les photos de
 * BluePoint (shooting) avant toute mise en ligne. Les anciennes photos du client sont
 * conservées dans references/photos-site-precedent/.
 */
export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export const PHOTOS = {
  vigneron: {
    src: "/assets/photos/vigneron.webp",
    width: 1128,
    height: 1400,
    alt: "Un vigneron souriant en tablier de cuir, accoudé à un tonneau au milieu des rangs",
    caption: "Chez le vigneron",
  },
  cave: {
    src: "/assets/photos/cave.webp",
    width: 1198,
    height: 783,
    alt: "Cinq bouteilles de vin rouge aux étiquettes illustrées et colorées, alignées sur fond clair",
    caption: "La cave",
  },
  etiquettes: {
    src: "/assets/photos/etiquettes.webp",
    width: 400,
    height: 400,
    alt: "Trois bouteilles de vin aux étiquettes dessinées, posées côte à côte",
    caption: "Les étiquettes",
  },
  vigne: {
    src: "/assets/photos/vigne.webp",
    width: 736,
    height: 920,
    alt: "Un vigneron en t-shirt rouge taille la vigne au milieu des feuilles",
    caption: "À la vigne",
  },
  sante: {
    src: "/assets/photos/sante.webp",
    width: 1120,
    height: 1400,
    alt: "Une main lève un verre de vin blanc au-dessus des vignes, sous un ciel clair",
    caption: "Santé",
  },
  aperitif: {
    src: "/assets/photos/aperitif.webp",
    width: 960,
    height: 1199,
    alt: "Un verre de vin blanc et sa bouteille sur un plateau argenté, devant un ciel bleu",
    caption: "L'apéritif",
  },
  blancRose: {
    src: "/assets/photos/blanc-rose.webp",
    width: 789,
    height: 1200,
    alt: "Deux mains tiennent une bouteille de blanc et une bouteille de rosé devant un pull vert",
    caption: "Blanc ou rosé",
  },
} as const satisfies Record<string, Photo>;
