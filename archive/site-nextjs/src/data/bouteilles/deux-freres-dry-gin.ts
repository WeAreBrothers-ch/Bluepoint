import type { Bottle } from "../types";

export const deuxFreresDryGin: Bottle = {
  slug: "deux-freres-dry-gin",
  name: "Dry Gin",
  producer: "Deux Frères",
  region: "Spiritueux, Suisse",
  grape: "Genièvre et botaniques",
  category: "spiritueux",
  description:
    "« Bis idem non est idem. » Un gin sec et floral, pensé par deux frères pour le tonic comme pour la dégustation pure.",
  priceCents: 5400,
  currency: "CHF",
  volumeMl: 500,
  abv: 43,
  image: {
    src: "/assets/bouteilles-detourees/deux-freres-dry-gin.webp",
    width: 565,
    height: 1400,
    alt: "Flacon ambré de Deux Frères Dry Gin, étiquette blanche",
  },
  photo: {
    src: "/assets/produits/deux-freres-dry-gin.webp",
    width: 400,
    height: 400,
    alt: "Photo provisoire : trois bouteilles aux étiquettes dessinées, côte à côte",
  },
  story: {
    tasting: "Genièvre franc, agrumes, une touche florale. Finale sèche et nette.",
    serving: "Pur sur glace, ou en gin tonic avec un zeste de citron.",
    storage: "Debout, à l'abri de la lumière. Se conserve plusieurs années une fois ouvert.",
    producer: "Deux frères, une même recette qu'ils ne font jamais deux fois tout à fait pareil.",
    pairings: [
      { moment: "Apéritif", dish: "Gin tonic et olives", why: "Le classique, avec un tonic sec pour garder le genièvre en tête." },
      { moment: "Entrée", dish: "Gravlax de truite", why: "Les botaniques répondent à l'aneth et au citron." },
      { moment: "Dessert", dish: "Sorbet citron, trait de gin", why: "Une fin de repas fraîche, en version adulte." },
    ],
  },
  provisional: ["description", "story"],
};
