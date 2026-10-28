import { SwissQRBill } from "swissqrbill/pdf";
import type { Data, Debtor } from "swissqrbill/types";
import type { FactureCalculee } from "../calcul";
import type { InvoiceBuyer } from "../schema";
import { dessinerPiedDePage, hauteurPiedDePage } from "./paiement";
import { ESPACES } from "./styles";

/** Le client n'apparaît dans la QR-facture que si son adresse structurée est complète. */
export function payeur(acheteur: InvoiceBuyer): Debtor | null {
  if (acheteur.street === undefined || acheteur.postalCode === undefined) return null;
  return {
    name: acheteur.company ?? acheteur.name,
    address: acheteur.street,
    ...(acheteur.buildingNumber === undefined ? {} : { buildingNumber: acheteur.buildingNumber }),
    zip: acheteur.postalCode,
    city: acheteur.city,
    country: acheteur.country,
  };
}

export function donneesQrFacture(f: FactureCalculee): Data {
  const { facture } = f;
  const { seller } = facture;
  const debiteur = payeur(facture.buyer);
  const commande = facture.orderReference === undefined ? "" : ` / Commande ${facture.orderReference}`;
  return {
    currency: facture.currency,
    amount: facture.totalCents / 100,
    reference: f.reference.valeur,
    message: `Facture ${facture.invoiceNumber}${commande}`,
    creditor: {
      account: f.compte,
      name: seller.name,
      address: seller.street,
      buildingNumber: seller.buildingNumber,
      zip: seller.postalCode,
      city: seller.city,
      country: seller.country,
    },
    ...(debiteur === null ? {} : { debtor: debiteur }),
  };
}

/**
 * Ajoute la QR-facture officielle en bas de page (A4), précédée du pied de page.
 * Si le contenu descend trop bas, l'ensemble est placé en bas d'une nouvelle page.
 */
export function ajouterQrFacture(doc: PDFKit.PDFDocument, f: FactureCalculee): void {
  const qrFacture = new SwissQRBill(donneesQrFacture(f), { language: "FR" });
  const yQr = doc.page.height - SwissQRBill.height;
  const espaceRequis = hauteurPiedDePage(doc, f) + 2 * ESPACES.avantQr;
  if (doc.y + espaceRequis > yQr) doc.addPage();
  dessinerPiedDePage(doc, f, yQr - ESPACES.avantQr);
  qrFacture.attachTo(doc, 0, yQr);
}
