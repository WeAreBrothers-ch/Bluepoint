import { formatIBAN, formatReference } from "swissqrbill/utils";
import type { FactureCalculee } from "../calcul";
import { formaterDate } from "../dates";
import { formaterCHF } from "../montants";
import { libelleValeur, typographier } from "../typographie";
import {
  assurerEspace,
  basDePage,
  bordGauche,
  ecrire,
  hauteurTexte,
  largeurUtile,
  STYLE_COURANT,
  STYLE_DISCRET,
  titreSection,
} from "./mise-en-page";
import { ESPACES, TAILLES } from "./styles";

/** Le rabais de paiement rapide, en une phrase ; rien si la facture n'en propose pas. */
function ligneRabais(f: FactureCalculee): string[] {
  const { earlyPayment, totalCents } = f.facture;
  if (earlyPayment === undefined) return [];
  const pourcent = String(earlyPayment.percent).replace(".", ",");
  return [
    typographier(
      `Rabais de ${pourcent} % si la facture est payée jusqu'au ${formaterDate(earlyPayment.deadline)} : ` +
        `${formaterCHF(earlyPayment.amountCents)} au lieu de ${formaterCHF(totalCents)} (indiquez ce montant dans votre e-banking).`,
    ),
  ];
}

function lignesPaiement(f: FactureCalculee): string[] {
  const { facture } = f;
  if (facture.paidOn !== undefined) {
    return [`Facture acquittée : payée en ligne le ${formaterDate(facture.paidOn)}. Aucun paiement supplémentaire n’est dû.`];
  }
  return [
    `${typographier(facture.paymentTerms)}, au plus tard le ${formaterDate(facture.dueDate)}, par QR-facture ou virement.`,
    ...ligneRabais(f),
    libelleValeur(f.reference.type === "QRR" ? "QR-IBAN" : "IBAN", formatIBAN(f.compte)),
    libelleValeur("Référence", formatReference(f.reference.valeur)),
  ];
}

export function dessinerPaiement(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  const lignes = lignesPaiement(f);
  const options = { width: largeurUtile(doc) };
  const hauteur = lignes.reduce((total, l) => total + hauteurTexte(doc, l, STYLE_COURANT, options), 20);
  assurerEspace(doc, hauteur);
  let y = titreSection(doc, "Paiement");
  for (const ligne of lignes) y = ecrire(doc, ligne, bordGauche(doc), y, STYLE_COURANT, options);
  doc.y = y;
}

const SEPARATEUR = "\u00a0\u00a0·\u00a0\u00a0";
const insecable = (texte: string): string => texte.replace(/ /g, "\u00a0");

/** Pied de page en deux lignes : identité et numéro TVA, puis contact. Chaque élément reste d'un seul tenant. */
export function textePiedDePage(f: FactureCalculee): string {
  const v = f.facture.seller;
  const identite = [v.name, `${v.street} ${v.buildingNumber}`, `${v.postalCode} ${v.city}`, v.vatNumber];
  return [identite.map(insecable).join(SEPARATEUR), [v.email, insecable(v.phone)].join(SEPARATEUR)].join("\n");
}

const STYLE_PIED = { ...STYLE_DISCRET, taille: TAILLES.mention };

export function hauteurPiedDePage(doc: PDFKit.PDFDocument, f: FactureCalculee): number {
  return hauteurTexte(doc, textePiedDePage(f), STYLE_PIED, { width: largeurUtile(doc) });
}

/** Pied de page posé juste au-dessus d'une hauteur donnée (le pointillé de la QR-facture). */
export function dessinerPiedDePage(doc: PDFKit.PDFDocument, f: FactureCalculee, yBas: number): void {
  const hauteur = hauteurPiedDePage(doc, f);
  ecrire(doc, textePiedDePage(f), bordGauche(doc), yBas - hauteur, STYLE_PIED, { width: largeurUtile(doc) });
}

/** Facture acquittée : pas de QR-facture, le pied de page se pose en bas de la dernière page. */
export function dessinerPiedDePageAcquittee(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  const hauteur = hauteurPiedDePage(doc, f);
  // Marge de 2 pt : un texte qui touche exactement le bas de page déclenche une page vide.
  const yBas = basDePage(doc) - 2;
  if (doc.y + hauteur + ESPACES.avantQr > yBas) doc.addPage();
  dessinerPiedDePage(doc, f, yBas);
}
