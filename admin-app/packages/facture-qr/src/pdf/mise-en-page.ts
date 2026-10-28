import { COULEURS, ESPACES, POLICES, TAILLES, TRAITS, type NomPolice } from "./styles";
import { adapterAuxGlyphes } from "./polices";

export function bordGauche(doc: PDFKit.PDFDocument): number {
  return doc.page.margins.left;
}

export function bordDroit(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.right;
}

export function largeurUtile(doc: PDFKit.PDFDocument): number {
  return bordDroit(doc) - bordGauche(doc);
}

export function basDePage(doc: PDFKit.PDFDocument): number {
  return doc.page.height - doc.page.margins.bottom;
}

/** Passe à la page suivante si le bloc à venir ne tient plus ; renvoie vrai si une page a été ajoutée. */
export function assurerEspace(doc: PDFKit.PDFDocument, hauteur: number): boolean {
  if (doc.y + hauteur <= basDePage(doc)) return false;
  doc.addPage();
  return true;
}

export interface StyleTexte {
  police: NomPolice;
  taille: number;
  couleur: string;
}

export const STYLE_COURANT: StyleTexte = { police: POLICES.normale, taille: TAILLES.texte, couleur: COULEURS.encre };
export const STYLE_DISCRET: StyleTexte = { police: POLICES.normale, taille: TAILLES.petit, couleur: COULEURS.gris };

export function appliquerStyle(doc: PDFKit.PDFDocument, style: StyleTexte): PDFKit.PDFDocument {
  return doc.font(style.police).fontSize(style.taille).fillColor(style.couleur);
}

/** Écrit un texte (adapté aux glyphes de la police) et renvoie la position sous le texte. */
export function ecrire(
  doc: PDFKit.PDFDocument,
  texte: string,
  x: number,
  y: number,
  style: StyleTexte,
  options: PDFKit.Mixins.TextOptions = {},
): number {
  appliquerStyle(doc, style).text(adapterAuxGlyphes(texte), x, y, { lineGap: ESPACES.ligne, ...options });
  return doc.y;
}

export function hauteurTexte(
  doc: PDFKit.PDFDocument,
  texte: string,
  style: StyleTexte,
  options: PDFKit.Mixins.TextOptions = {},
): number {
  appliquerStyle(doc, style);
  return doc.heightOfString(adapterAuxGlyphes(texte), { lineGap: ESPACES.ligne, ...options });
}

export function filet(doc: PDFKit.PDFDocument, y: number, epaisseur: number = TRAITS.filet, couleur: string = COULEURS.filet): void {
  doc.save().moveTo(bordGauche(doc), y).lineTo(bordDroit(doc), y).lineWidth(epaisseur).strokeColor(couleur).stroke().restore();
}

/** Titre de section : petit carré bleu suivi du libellé en capitales espacées. */
export function titreSection(doc: PDFKit.PDFDocument, titre: string, x: number = bordGauche(doc), y: number = doc.y): number {
  const style: StyleTexte = { police: POLICES.moyenne, taille: TAILLES.petit, couleur: COULEURS.encre };
  const hauteurCapitale = TAILLES.petit * 0.7;
  doc.save().rect(x, y + (TAILLES.petit - ESPACES.carre) / 2 + 0.6, ESPACES.carre, ESPACES.carre).fill(COULEURS.bleu).restore();
  ecrire(doc, titre.toLocaleUpperCase("fr-CH"), x + ESPACES.carre + 5, y, style, { characterSpacing: 0.8, lineBreak: false });
  return y + Math.max(hauteurCapitale, TAILLES.petit) + 7;
}
