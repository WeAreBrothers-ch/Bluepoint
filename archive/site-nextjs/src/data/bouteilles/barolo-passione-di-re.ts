import type { Bottle } from "../types";

export const baroloPassioneDiRe: Bottle = {
  slug: "barolo-passione-di-re",
  name: "Passione di Re",
  producer: "Gabriele Scaglione",
  region: "Barolo DOCG, Piémont",
  grape: "Nebbiolo",
  category: "rouge",
  description:
    "Un Barolo de Langhe, droit et profond, taillé pour la garde. Les rois dessinés sur l'étiquette annoncent un vin de caractère.",
  priceCents: 4500,
  currency: "CHF",
  volumeMl: 750,
  abv: 14.5,
  image: {
    src: "/assets/bouteilles-detourees/barolo-passione-di-re.webp",
    width: 279,
    height: 1056,
    alt: "Bouteille de Barolo Passione di Re, étiquette blanche illustrée de rois",
  },
  photo: {
    src: "/assets/produits/barolo-passione-di-re.webp",
    width: 564,
    height: 752,
    alt: "Photo provisoire : une main tient une bouteille de rouge à l'étiquette dessinée, sur une table en bois",
  },
  story: {
    tasting: "Cerise noire, rose séchée, réglisse. Des tanins serrés qui s'arrondissent à l'air.",
    serving: "Entre 16 et 18 °C. Carafer une heure avant le repas.",
    storage: "Couchée, à l'abri de la lumière, entre 12 et 14 °C. Se garde dix ans et plus.",
    producer:
      "Gabriele Scaglione travaille ses vignes des Langhe en famille, à la main, sur de petites parcelles.",
    pairings: [
      { moment: "Apéritif", dish: "Grana et noix", why: "Le sel du fromage détend les tanins dès la première gorgée." },
      { moment: "Plat", dish: "Risotto aux truffes", why: "Le Nebbiolo et la truffe partagent les mêmes notes de sous-bois." },
      { moment: "Fromage", dish: "Castelmagno affiné", why: "Un fromage de caractère pour un vin qui en a autant." },
    ],
  },
  provisional: ["description", "abv", "story"],
};
