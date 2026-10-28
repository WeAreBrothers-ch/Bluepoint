/** Identité visuelle BluePoint pour les documents imprimés (jetons repris du thème du site). */
export const COULEURS = {
  encre: "#0e0f10",
  gris: "#63676b",
  filet: "#d4d4d0",
  /** Bleu du logo : réservé au logo et aux carrés de section, jamais en aplat. */
  bleu: "#1a70b7",
} as const;

export const POLICES = {
  normale: "GeistMono",
  moyenne: "GeistMono-Medium",
  grasse: "GeistMono-SemiBold",
} as const;

export type NomPolice = (typeof POLICES)[keyof typeof POLICES];

export const TAILLES = {
  numero: 15,
  total: 11,
  texte: 8.5,
  petit: 7,
  mention: 6.5,
} as const;

/** 15 mm de marge latérale, en points PDF. */
export const MARGE = 42.52;
/** 12 mm en haut : la QR-facture (105 mm) doit tenir sur la même page. */
export const MARGE_HAUTE = 34.02;
export const MARGE_BASSE = 34.02;

export const ESPACES = {
  ligne: 2,
  apresBloc: 14,
  cellule: 5,
  carre: 4.5,
  /** Espace minimal entre le pied de page et le pointillé de découpe de la QR-facture. */
  avantQr: 10,
} as const;

export const TRAITS = {
  filet: 0.5,
  appuye: 0.9,
} as const;

export const HAUTEUR_LOGO = 30;
