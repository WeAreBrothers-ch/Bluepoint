import type { Bottle } from "../types";

export const brunelloSalvioni: Bottle = {
  slug: "brunello-di-montalcino-salvioni",
  name: "Brunello di Montalcino",
  producer: "Salvioni, La Cerbaiola",
  region: "Montalcino, Toscane",
  grape: "Sangiovese",
  category: "rouge",
  description:
    "Une petite propriété familiale devenue une référence du Brunello. Du Sangiovese à son sommet, en quantités confidentielles.",
  priceCents: 12000,
  currency: "CHF",
  volumeMl: 750,
  abv: 14,
  image: {
    src: "/assets/bouteilles-detourees/brunello-salvioni.webp",
    width: 318,
    height: 1221,
    alt: "Bouteille de Brunello di Montalcino Salvioni, étiquette noire et blason",
  },
  photo: {
    src: "/assets/produits/brunello-salvioni.webp",
    width: 736,
    height: 1003,
    alt: "Photo provisoire : une bouteille de rouge à l'étiquette rouge et orange, sur fond crème",
  },
  story: {
    tasting: "Griotte, cuir, herbes de Toscane. Ample, long, d'une grande fraîcheur.",
    serving: "Entre 17 et 18 °C. Ouvrir deux heures avant, carafer si jeune.",
    storage: "Couchée, au frais et au calme. Un vin de garde de quinze ans et plus.",
    producer:
      "La famille Salvioni produit à La Cerbaiola quelques milliers de bouteilles par an, parmi les plus recherchées de Montalcino.",
    pairings: [
      { moment: "Entrée", dish: "Crostini aux foies de volaille", why: "Le fruit du Sangiovese équilibre la richesse du pâté." },
      { moment: "Plat", dish: "Bistecca alla fiorentina", why: "L'accord toscan par excellence : la braise répond au cuir." },
      { moment: "Fromage", dish: "Pecorino de Pienza", why: "Deux produits du même coin de Toscane, qui se connaissent." },
    ],
  },
  provisional: ["description", "abv", "story"],
};
