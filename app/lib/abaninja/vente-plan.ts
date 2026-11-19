import type { InvoiceInput } from "@bluepoint/facture-qr";
import { success, type Result } from "../core/result";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import { orderNameOf, salePositions, saleStamp, swissDate, testClientOf, testReference, type TestClient } from "./vente-positions";

/**
 * Facture AbaNinja d'une commande fictive livrée (« J'ai livré ») : prépare, sans rien envoyer, le client
 * d'essai et la facture, à partir des lignes que l'app calcule déjà pour ses propres factures (mêmes prix,
 * même TVA, même total). Fonction pure ; chaque refus est écrit pour Eliott.
 */

/** Début de la référence de toutes les factures d'essai faites par « J'ai livré ». */
export const SALE_TEST_PREFIX = "BP-ESSAI-FACT-";

export type SaleInvoiceBody = Omit<AbaNinjaInvoiceInput, "receiver" | "bankAccountUuid">;

export interface SaleInvoicePlan extends TestClient {
  readonly reference: string;
  /** La facture, sans destinataire ni compte bancaire (connus une fois le client créé dans AbaNinja). */
  readonly invoice: SaleInvoiceBody;
}

/** Corps de la facture d'une commande livrée, sous une référence donnée (celle de l'essai ou celle du bon). */
export function saleInvoiceBody(
  input: InvoiceInput,
  meta: { readonly reference: string; readonly orderName: string; readonly deliveryDate: string },
): Result<SaleInvoiceBody, Error> {
  const positions = salePositions(input);
  if (!positions.ok) return positions;
  return success({
    reference: meta.reference,
    title: `Facture ${meta.orderName} (essai)`.slice(0, 75),
    currencyCode: "CHF",
    invoiceDate: input.issueDate,
    dueDate: input.dueDate,
    pricesIncludeVat: true,
    terms: input.paymentTerms,
    publicNotes: `Commande ${meta.orderName}, livrée le ${swissDate(meta.deliveryDate)}.`,
    positions: positions.value,
  });
}

/** `forPro` : commande d'un pro, sa facture va au client pro fictif (le même que celui des bons). */
export function planTestSaleInvoice(input: InvoiceInput, now: Date, forPro: boolean): Result<SaleInvoicePlan, Error> {
  const stamp = saleStamp(now);
  const reference = testReference(SALE_TEST_PREFIX, input, stamp);
  const invoice = saleInvoiceBody(input, { reference, orderName: orderNameOf(input), deliveryDate: input.deliveryDate });
  if (!invoice.ok) return invoice;
  return success({ reference, ...testClientOf(input, forPro, stamp, "essai-fact"), invoice: invoice.value });
}
