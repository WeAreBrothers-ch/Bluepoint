import type { Bottle } from "../types";

export const dezaleyTourMarsens: Bottle = {
  slug: "dezaley-tour-marsens",
  name: "Dézaley Marsens",
  producer: "Arthur Duplan, Domaine de la Tour de Marsens",
  region: "Dézaley Grand Cru, Lavaux",
  grape: "Chasselas",
  category: "blanc",
  description:
    "Le Chasselas des terrasses du Lavaux, à quelques kilomètres de Lutry. Minéral et précis : le vin qui raconte le mieux notre rive.",
  priceCents: 2500,
  currency: "CHF",
  volumeMl: 750,
  abv: 12.5,
  image: {
    src: "/assets/bouteilles-detourees/dezaley-tour-marsens.webp",
    width: 325,
    height: 1361,
    alt: "Bouteille de Dézaley Marsens Grand Cru, verre clair et capsule cuivrée",
  },
  photo: {
    src: "/assets/produits/dezaley-tour-marsens.webp",
    width: 736,
    height: 1308,
    alt: "Photo provisoire : une main tient une bouteille de blanc à l'étiquette illustrée en bleu",
  },
  story: {
    tasting: "Tilleul, pierre à fusil, une pointe de miel. Bouche saline et tendue.",
    serving: "Entre 9 et 11 °C, dans un verre à vin blanc.",
    storage: "Au frais, couchée. Se boit dès maintenant ou se garde cinq à huit ans.",
    producer:
      "La Tour de Marsens domine les terrasses du Dézaley, classées au patrimoine mondial de l'UNESCO.",
    pairings: [
      { moment: "Apéritif", dish: "Tomme vaudoise et pain de seigle", why: "Un apéritif du coin, simple, qui laisse parler le Chasselas." },
      { moment: "Plat", dish: "Filets de perche du Léman", why: "L'accord de la rive : le vin et le poisson viennent du même paysage." },
      { moment: "Fromage", dish: "Gruyère d'alpage", why: "La minéralité du vin tient tête au fromage sans l'écraser." },
    ],
  },
  provisional: ["description", "abv", "story"],
};
