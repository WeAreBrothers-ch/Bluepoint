import type { FactureCalculee } from "../calcul";
import { formaterDate } from "../dates";
import type { InvoiceBuyer, InvoiceSeller } from "../schema";
import { dessinerLogo } from "./logo";
import {
  bordDroit,
  bordGauche,
  ecrire,
  filet,
  largeurUtile,
  STYLE_COURANT,
  STYLE_DISCRET,
  titreSection,
  type StyleTexte,
} from "./mise-en-page";
import { COULEURS, ESPACES, HAUTEUR_LOGO, POLICES, TAILLES } from "./styles";

const STYLE_NOM: StyleTexte = { ...STYLE_COURANT, police: POLICES.moyenne };
const STYLE_NUMERO: StyleTexte = { police: POLICES.grasse, taille: TAILLES.numero, couleur: COULEURS.encre };

function localite(postalCode: string | undefined, city: string, country: string): string[] {
  const ligne = [postalCode, city].filter(Boolean).join(" ");
  return country === "CH" ? [ligne] : [ligne, country];
}

/** E-mail et téléphone figurent dans le pied de page : ici, seulement l'adresse et le numéro TVA. */
function lignesVendeur(v: InvoiceSeller): string[] {
  return [`${v.street} ${v.buildingNumber}`, ...localite(v.postalCode, v.city, v.country), v.vatNumber];
}

function lignesAcheteur(a: InvoiceBuyer): { nom: string; details: string[] } {
  const rue = a.street === undefined ? [] : [[a.street, a.buildingNumber].filter(Boolean).join(" ")];
  const contact = a.company === undefined ? [] : [a.name];
  return { nom: a.company ?? a.name, details: [...contact, ...rue, ...localite(a.postalCode, a.city, a.country)] };
}

function dessinerPartie(doc: PDFKit.PDFDocument, titre: string, nom: string, details: readonly string[], x: number, y: number, largeur: number): number {
  let curseur = titreSection(doc, titre, x, y);
  curseur = ecrire(doc, nom, x, curseur, STYLE_NOM, { width: largeur });
  for (const detail of details) curseur = ecrire(doc, detail, x, curseur, STYLE_COURANT, { width: largeur });
  return curseur;
}

/** Logo à gauche, « Facture » (ou « Facture acquittée ») et numéro à droite, puis un filet. */
function dessinerBandeauTitre(doc: PDFKit.PDFDocument, numero: string, acquittee: boolean): void {
  const x = bordGauche(doc);
  const y = doc.y;
  dessinerLogo(doc, x, y, HAUTEUR_LOGO);
  const largeur = 220;
  const xDroite = bordDroit(doc) - largeur;
  ecrire(doc, acquittee ? "FACTURE ACQUITTÉE" : "FACTURE", xDroite, y, { ...STYLE_DISCRET, police: POLICES.moyenne }, { width: largeur, align: "right", characterSpacing: 0.8 });
  ecrire(doc, numero, xDroite, y + 11, STYLE_NUMERO, { width: largeur, align: "right" });
  const yFilet = y + HAUTEUR_LOGO + 10;
  filet(doc, yFilet);
  doc.y = yFilet + ESPACES.apresBloc;
}

/** Émetteur et client côte à côte (mentions obligatoires : nom, lieu, numéro TVA). */
function dessinerParties(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  const x = bordGauche(doc);
  const y = doc.y;
  const colonne = largeurUtile(doc) / 2;
  const acheteur = lignesAcheteur(f.facture.buyer);
  const finGauche = dessinerPartie(doc, "Émetteur", f.facture.seller.name, lignesVendeur(f.facture.seller), x, y, colonne - 12);
  const finDroite = dessinerPartie(doc, "Facturé à", acheteur.nom, acheteur.details, x + colonne, y, colonne - 12);
  doc.x = x;
  doc.y = Math.max(finGauche, finDroite) + ESPACES.apresBloc;
}

function cellulesInfos(f: FactureCalculee): [string, string][] {
  const { facture } = f;
  const commande: [string, string][] =
    facture.orderReference === undefined
      ? []
      : [
          facture.orderDate === undefined
            ? ["Commande", facture.orderReference]
            : [`Commande ${facture.orderReference}`, formaterDate(facture.orderDate)],
        ];
  const bonCommande: [string, string][] = facture.poNumber === undefined ? [] : [["Votre référence", facture.poNumber]];
  return [
    ["Date de facture", formaterDate(facture.issueDate)],
    ["Date de livraison", formaterDate(facture.deliveryDate)],
    facture.paidOn === undefined ? ["Échéance", formaterDate(facture.dueDate)] : ["Payée le", formaterDate(facture.paidOn)],
    ...commande,
    ...bonCommande,
  ];
}

/** Rangée de dates et de références, entre deux filets. */
function dessinerInfos(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  const cellules = cellulesInfos(f);
  const x = bordGauche(doc);
  const yHaut = doc.y;
  const largeur = largeurUtile(doc) / cellules.length;
  filet(doc, yHaut);
  let bas = yHaut;
  cellules.forEach(([libelle, valeur], i) => {
    const xCellule = x + i * largeur;
    const sousLibelle = ecrire(doc, libelle, xCellule, yHaut + ESPACES.cellule + 1, STYLE_DISCRET, { width: largeur - 8 });
    bas = Math.max(bas, ecrire(doc, valeur, xCellule, sousLibelle, STYLE_COURANT, { width: largeur - 8 }));
  });
  const yBas = bas + ESPACES.cellule - 1;
  filet(doc, yBas);
  doc.x = x;
  doc.y = yBas + ESPACES.apresBloc + 4;
}

export function dessinerEntete(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  dessinerBandeauTitre(doc, f.facture.invoiceNumber, f.facture.paidOn !== undefined);
  dessinerParties(doc, f);
  dessinerInfos(doc, f);
}
