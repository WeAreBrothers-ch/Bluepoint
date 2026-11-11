import type { TableMoment } from "./types";

export interface MomentTile {
  moment: TableMoment;
  title: string;
  dishes: string;
  bottleSlug: string;
}

/** La bouteille mise en avant dans le haut de l'accueil (« À la une »). */
export const FEATURED_SLUG = "barolo-passione-di-re";

/** Le titre de l'accueil, découpé en lignes pour l'animation d'entrée. */
export const HERO_LINES: ReadonlyArray<string> = ["Les vignerons", "d'exception,", "directement", "chez vous."];

/** Repères chiffrés de la maison (repris du site actuel). */
export const HOUSE_FACTS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "Importateur depuis", value: "2003" },
  { label: "Producteurs", value: "22" },
  { label: "Livraison", value: "48 h" },
  { label: "Offerte dès", value: "24 btl" },
];

/** Lutry (VD), pour le bloc « coordonnées ». */
export const LUTRY = {
  place: "Lutry, Vaud",
  latitude: "46.5028° N",
  longitude: "6.6855° E",
  timeZone: "Europe/Zurich",
} as const;

/** Tuiles « à chaque moment de la table » (textes provisoires, à valider). */
export const momentTiles: ReadonlyArray<MomentTile> = [
  {
    moment: "Apéritif",
    title: "Pour l'apéritif",
    dishes: "Fritto misto, olives, tomme vaudoise",
    bottleSlug: "col-del-forno-prosecco",
  },
  {
    moment: "Plat",
    title: "Pour le plat",
    dishes: "Filets de perche, risotto, viande grillée",
    bottleSlug: "dezaley-tour-marsens",
  },
  {
    moment: "Fromage",
    title: "Pour le fromage",
    dishes: "Castelmagno, gruyère d'alpage, pecorino",
    bottleSlug: "barolo-passione-di-re",
  },
];
