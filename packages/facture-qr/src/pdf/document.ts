import PDFDocument from "pdfkit";
import { ValidationError } from "swissqrbill/errors";
import { calculerFacture, type FactureCalculee } from "../calcul";
import { FactureError } from "../erreurs";
import type { InvoiceInput } from "../schema";
import { validateInvoiceInput } from "../validation";
import { dessinerArticles } from "./articles";
import { dessinerEntete } from "./entete";
import { bordDroit, ecrire, STYLE_DISCRET } from "./mise-en-page";
import { dessinerPaiement, dessinerPiedDePageAcquittee } from "./paiement";
import { enregistrerPolices } from "./polices";
import { ajouterQrFacture } from "./qr";
import { dessinerRecapitulatif } from "./recapitulatif";
import { MARGE, MARGE_BASSE, MARGE_HAUTE } from "./styles";

/** Numérote les pages (« 1/2 ») seulement si la facture en compte plusieurs. */
function numeroterPages(doc: PDFKit.PDFDocument, numero: string): void {
  const { start, count } = doc.bufferedPageRange();
  if (count < 2) return;
  for (let i = 0; i < count; i += 1) {
    doc.switchToPage(start + i);
    const largeur = 200;
    const y = doc.page.margins.top / 2 - 3;
    ecrire(doc, `${numero}  ·  ${i + 1}/${count}`, bordDroit(doc) - largeur, y, STYLE_DISCRET, {
      width: largeur,
      align: "right",
      lineBreak: false,
    });
  }
}

function dessiner(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  enregistrerPolices(doc);
  dessinerEntete(doc, f);
  dessinerArticles(doc, f);
  dessinerRecapitulatif(doc, f);
  dessinerPaiement(doc, f);
  if (f.facture.paidOn === undefined) ajouterQrFacture(doc, f);
  else dessinerPiedDePageAcquittee(doc, f);
  numeroterPages(doc, f.facture.invoiceNumber);
}

function erreurLisible(erreur: unknown): FactureError {
  if (erreur instanceof FactureError) return erreur;
  if (erreur instanceof ValidationError) return new FactureError(`QR-facture refusée : ${erreur.message}`);
  const detail = erreur instanceof Error ? erreur.message : "erreur inconnue";
  return new FactureError(`Création du PDF impossible : ${detail}`);
}

function produirePdf(facture: FactureCalculee): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: { top: MARGE_HAUTE, bottom: MARGE_BASSE, left: MARGE, right: MARGE },
    info: { Title: `${facture.facture.paidOn === undefined ? "Facture" : "Facture acquittée"} ${facture.facture.invoiceNumber}`, Author: facture.facture.seller.name },
    lang: "fr-CH",
  });
  const morceaux: Buffer[] = [];
  const termine = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (morceau: Buffer) => morceaux.push(morceau));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", (erreur: unknown) => reject(erreurLisible(erreur)));
  });
  try {
    dessiner(doc, facture);
  } catch (erreur) {
    return Promise.reject(erreurLisible(erreur));
  } finally {
    doc.end();
  }
  return termine;
}

/**
 * Produit le PDF complet (facture + QR-facture, ou facture acquittée sans QR) en mémoire. Aucun fichier écrit, aucun accès réseau.
 * Les données sont revalidées : un objet modifié après validation ne peut pas produire une facture fausse.
 */
export async function renderInvoicePdf(input: InvoiceInput): Promise<Buffer> {
  return produirePdf(calculerFacture(validateInvoiceInput(input)));
}
