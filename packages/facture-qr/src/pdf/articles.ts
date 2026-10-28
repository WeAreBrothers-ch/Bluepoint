import type { FactureCalculee } from "../calcul";
import { formaterCHF, formaterMontant } from "../montants";
import type { InvoiceLine } from "../schema";
import { libelleValeur, typographier } from "../typographie";
import {
  assurerEspace,
  bordGauche,
  ecrire,
  filet,
  hauteurTexte,
  largeurUtile,
  STYLE_COURANT,
  STYLE_DISCRET,
  titreSection,
  type StyleTexte,
} from "./mise-en-page";
import { COULEURS, ESPACES, POLICES, TRAITS } from "./styles";

interface Colonne {
  titre: string;
  /** Largeur fixe en points ; la colonne sans largeur prend le reste. */
  largeur?: number;
  aDroite: boolean;
}

const COLONNES: readonly Colonne[] = [
  { titre: "Désignation", aDroite: false },
  { titre: "Qté", largeur: 42, aDroite: true },
  { titre: "Prix unit.", largeur: 78, aDroite: true },
  { titre: "Total CHF", largeur: 86, aDroite: true },
];

const STYLE_DESIGNATION: StyleTexte = { ...STYLE_COURANT, police: POLICES.moyenne };

function largeurs(doc: PDFKit.PDFDocument): number[] {
  const fixes = COLONNES.reduce((total, c) => total + (c.largeur ?? 0), 0);
  return COLONNES.map((c) => c.largeur ?? largeurUtile(doc) - fixes);
}

/** Genre et objet de la livraison (art. 26 LTVA) : producteur, contenant, rabais de ligne éventuel. */
function precisions(ligne: InvoiceLine): string[] {
  const origine = [ligne.producer, ligne.volumeLabel].filter(Boolean).join(" · ");
  const rabais = ligne.quantity * ligne.unitPriceCents - ligne.totalCents;
  return [
    ...(origine === "" ? [] : [typographier(origine)]),
    ...(rabais > 0 ? [libelleValeur("Rabais", formaterCHF(-rabais))] : []),
  ];
}

function dessinerEnTete(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  let x = bordGauche(doc);
  largeurs(doc).forEach((largeur, i) => {
    const colonne = COLONNES[i];
    if (colonne === undefined) return;
    ecrire(doc, colonne.titre, x, y, STYLE_DISCRET, { width: largeur, align: colonne.aDroite ? "right" : "left", lineBreak: false });
    x += largeur;
  });
  const yFilet = y + 12;
  filet(doc, yFilet, TRAITS.appuye, COULEURS.encre);
  doc.y = yFilet;
}

function hauteurLigne(doc: PDFKit.PDFDocument, ligne: InvoiceLine, largeurDesignation: number): number {
  const options = { width: largeurDesignation - 12 };
  const designation = hauteurTexte(doc, typographier(ligne.description), STYLE_DESIGNATION, options);
  const details = precisions(ligne).reduce((total, p) => total + hauteurTexte(doc, p, STYLE_DISCRET, options), 0);
  return designation + details + 2 * ESPACES.cellule;
}

function dessinerLigne(doc: PDFKit.PDFDocument, ligne: InvoiceLine): void {
  const tailles = largeurs(doc);
  const largeurDesignation = tailles[0] ?? 0;
  const hauteur = hauteurLigne(doc, ligne, largeurDesignation);
  if (assurerEspace(doc, hauteur)) dessinerEnTete(doc);
  const y = doc.y + ESPACES.cellule;
  let x = bordGauche(doc);
  let curseur = ecrire(doc, typographier(ligne.description), x, y, STYLE_DESIGNATION, { width: largeurDesignation - 12 });
  for (const precision of precisions(ligne)) {
    curseur = ecrire(doc, precision, x, curseur, STYLE_DISCRET, { width: largeurDesignation - 12 });
  }
  const valeurs = [ligne.quantity.toString(), formaterMontant(ligne.unitPriceCents), formaterMontant(ligne.totalCents)];
  x += largeurDesignation;
  valeurs.forEach((valeur, i) => {
    const largeur = tailles[i + 1] ?? 0;
    ecrire(doc, valeur, x, y, STYLE_COURANT, { width: largeur, align: "right", lineBreak: false });
    x += largeur;
  });
  const yBas = curseur + ESPACES.cellule - ESPACES.ligne;
  filet(doc, yBas);
  doc.x = bordGauche(doc);
  doc.y = yBas;
}

/** Tableau des articles : en-tête souligné d'un trait d'encre, lignes séparées par des filets fins. */
export function dessinerArticles(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  assurerEspace(doc, 70);
  doc.y = titreSection(doc, "Articles");
  dessinerEnTete(doc);
  for (const ligne of f.facture.lines) dessinerLigne(doc, ligne);
  doc.y += ESPACES.apresBloc;
}
