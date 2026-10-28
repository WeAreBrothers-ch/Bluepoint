import type { FactureCalculee } from "../calcul";
import { formaterCHF, formaterMontant, formaterTaux } from "../montants";
import { libelleValeur, typographier } from "../typographie";
import { assurerEspace, bordDroit, ecrire, STYLE_COURANT, STYLE_DISCRET, type StyleTexte } from "./mise-en-page";
import { COULEURS, ESPACES, POLICES, TAILLES, TRAITS } from "./styles";

interface LigneRecap {
  libelle: string;
  montant: string;
}

const LARGEUR_BLOC = 270;
const LARGEUR_MONTANT = 96;
const HAUTEUR_LIGNE = 13;
const STYLE_TOTAL: StyleTexte = { police: POLICES.grasse, taille: TAILLES.total, couleur: COULEURS.encre };

/** Lignes intermédiaires, du montant des articles jusqu'au total. */
function lignesRecap(f: FactureCalculee): LigneRecap[] {
  const { facture, totaux } = f;
  const lignes: LigneRecap[] = [{ libelle: "Articles", montant: formaterMontant(totaux.articlesCents) }];
  for (const rabais of facture.discounts) {
    lignes.push({ libelle: typographier(rabais.label), montant: formaterMontant(-rabais.amountCents) });
  }
  if (facture.shipping !== undefined) {
    lignes.push({ libelle: typographier(facture.shipping.label), montant: formaterMontant(facture.shipping.amountCents) });
  }
  if (!facture.taxesIncluded) {
    const horsTva = totaux.articlesCents - totaux.rabaisCents + totaux.livraisonCents;
    lignes.push({ libelle: "Total hors TVA", montant: formaterMontant(horsTva) });
    for (const tva of facture.vatLines) {
      lignes.push({ libelle: `TVA ${formaterTaux(tva.ratePercent)}`, montant: formaterMontant(tva.amountCents) });
    }
  }
  return lignes;
}

/** Mention de la TVA comprise dans les prix (taux et montant, art. 26 LTVA). */
function mentionsTvaIncluse(f: FactureCalculee): string[] {
  if (!f.facture.taxesIncluded) return [];
  return f.facture.vatLines.map((tva) => libelleValeur(`TVA ${formaterTaux(tva.ratePercent)} incluse`, formaterCHF(tva.amountCents)));
}

function ligneDeuxColonnes(doc: PDFKit.PDFDocument, ligne: LigneRecap, y: number, style: StyleTexte): void {
  const xBloc = bordDroit(doc) - LARGEUR_BLOC;
  ecrire(doc, ligne.libelle, xBloc, y, style, { width: LARGEUR_BLOC - LARGEUR_MONTANT, lineBreak: false, ellipsis: true });
  ecrire(doc, ligne.montant, bordDroit(doc) - LARGEUR_MONTANT, y, style, { width: LARGEUR_MONTANT, align: "right", lineBreak: false });
}

/** Bloc des totaux, aligné à droite sous le tableau des articles. */
export function dessinerRecapitulatif(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  const lignes = lignesRecap(f);
  const mentions = mentionsTvaIncluse(f);
  assurerEspace(doc, (lignes.length + mentions.length) * HAUTEUR_LIGNE + 30);
  const xBloc = bordDroit(doc) - LARGEUR_BLOC;
  let y = doc.y;
  for (const ligne of lignes) {
    ligneDeuxColonnes(doc, ligne, y, STYLE_COURANT);
    y += HAUTEUR_LIGNE;
  }
  doc.save().moveTo(xBloc, y).lineTo(bordDroit(doc), y).lineWidth(TRAITS.appuye).strokeColor(COULEURS.encre).stroke().restore();
  y += 6;
  ligneDeuxColonnes(doc, { libelle: "Total", montant: formaterCHF(f.facture.totalCents) }, y, STYLE_TOTAL);
  y += HAUTEUR_LIGNE + 4;
  for (const mention of mentions) {
    ecrire(doc, mention, xBloc, y, STYLE_DISCRET, { width: LARGEUR_BLOC, align: "right", lineBreak: false });
    y += HAUTEUR_LIGNE - 3;
  }
  doc.y = y + ESPACES.apresBloc;
}
