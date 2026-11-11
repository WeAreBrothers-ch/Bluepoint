import type { Bottle } from "../types";

export const colDelFornoProsecco: Bottle = {
  slug: "col-del-forno-prosecco",
  name: "Col del Forno",
  producer: "Andreola",
  region: "Valdobbiadene DOCG, Vénétie",
  grape: "Glera",
  category: "effervescent",
  description:
    "Un Prosecco de coteaux, Rive di Refrontolo, fin et salin. Celui qu'on ouvre quand on reçoit sans cérémonie.",
  priceCents: 1800,
  currency: "CHF",
  volumeMl: 750,
  abv: 11,
  image: {
    src: "/assets/bouteilles-detourees/col-del-forno-prosecco.webp",
    width: 386,
    height: 1212,
    alt: "Bouteille noire de Prosecco Col del Forno, rose en relief sur le verre",
  },
  photo: {
    src: "/assets/produits/col-del-forno-prosecco.webp",
    width: 1067,
    height: 1600,
    alt: "Photo provisoire : une bouteille à l'étiquette jaune, inclinée devant un ciel bleu",
  },
  story: {
    tasting: "Poire, fleur d'acacia, bulle fine. Une finale sèche et saline.",
    serving: "Entre 6 et 8 °C, dans un verre à vin plutôt qu'une flûte.",
    storage: "Debout, au frais. À boire dans les deux ans.",
    producer:
      "Andreola cultive les coteaux abrupts de Valdobbiadene, où tout se vendange à la main.",
    pairings: [
      { moment: "Apéritif", dish: "Fritto misto", why: "La bulle nettoie le gras de la friture, bouchée après bouchée." },
      { moment: "Entrée", dish: "Carpaccio de poisson", why: "La salinité du vin prolonge celle de la mer." },
      { moment: "Dessert", dish: "Tarte aux fruits blancs", why: "Assez sec pour ne pas alourdir un dessert fruité." },
    ],
  },
  provisional: ["description", "abv", "story"],
};
