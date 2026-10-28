import { referencePaiement, type ReferencePaiement } from "./reference";
import type { InvoiceInput } from "./schema";
import { calculerTotaux, type Totaux } from "./totaux";

/** Tout ce qu'il faut pour dessiner la facture, calculé et vérifié à l'avance. */
export interface FactureCalculee {
  facture: InvoiceInput;
  totaux: Totaux;
  reference: ReferencePaiement;
  /** Compte encodé dans la QR-facture : le QR-IBAN s'il existe, sinon l'IBAN. */
  compte: string;
}

export function calculerFacture(facture: InvoiceInput): FactureCalculee {
  const { qrIban, iban } = facture.seller;
  return {
    facture,
    totaux: calculerTotaux(facture),
    reference: referencePaiement(facture.invoiceNumber, qrIban !== undefined),
    compte: qrIban ?? iban,
  };
}
