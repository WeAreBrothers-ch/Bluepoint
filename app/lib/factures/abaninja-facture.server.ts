import { FactureError, mapShopifyOrderToInvoiceInput, type InvoiceInput } from "@bluepoint/facture-qr";
import prisma from "../../db.server";
import { FICTITIOUS_TAG } from "../abaninja/bl-essai-order";
import { readAbaNinjaConfig } from "../abaninja/config.server";
import { ERASE_HINT, type SaleInvoiceError } from "../abaninja/vente-errors";
import { createTestSaleInvoice, type SaleInvoiceDocument } from "../abaninja/vente-facture.server";
import { planTestSaleInvoice } from "../abaninja/vente-plan";
import { logError, logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import type { IsoDate } from "../metafields/definitions";
import { toInvoiceSeller } from "../reglages/seller";
import type { ShopSettingsValues } from "../reglages/schema";
import type { OrderGid } from "../shopify/ids";
import { contactOf } from "./delivery-date";
import type { EnsuredInvoice } from "./ensured";
import { InvoiceError } from "./errors";
import { plainInvoiceProblems } from "./plain-problems";
import { invoicePdfKey, type Invoice } from "./repository.server";
import type { OrderForInvoice } from "./shopify-order.server";

/**
 * Facture d'une commande d'essai (étiquetée « fictif ») : elle se fait dans AbaNinja, et l'app en garde
 * une copie (numéro AbaNinja et PDF) pour qu'Eliott l'envoie avec les boutons habituels. Les vraies
 * commandes restent sur les factures BluePoint tant qu'AbaNinja n'est pas allumé pour elles.
 */

export interface AbaNinjaSale {
  readonly shop: string;
  readonly orderId: OrderGid;
  readonly source: OrderForInvoice;
  readonly settings: ShopSettingsValues;
  readonly deliveryDate: IsoDate;
  readonly issueDate: IsoDate;
  readonly now: Date;
}

export function goesToAbaNinja(source: OrderForInvoice): boolean {
  return source.contact.tags.includes(FICTITIOUS_TAG);
}

/** Numéro provisoire, jamais imprimé : le moteur de facture exige un chiffre (pour la référence QR) ; AbaNinja donne le vrai. */
const PLACEHOLDER_NUMBER = "ABANINJA-1";

/** Mêmes lignes, même TVA et même total que la facture BluePoint de cette commande. */
function invoiceLinesOf(sale: AbaNinjaSale): Result<InvoiceInput, InvoiceError> {
  try {
    const meta = { invoiceNumber: PLACEHOLDER_NUMBER, issueDate: sale.issueDate, deliveryDate: sale.deliveryDate, paymentTermDays: sale.settings.paymentTermDays };
    return success(mapShopifyOrderToInvoiceInput(sale.source.order, toInvoiceSeller(sale.settings), meta));
  } catch (error) {
    if (!(error instanceof FactureError)) throw error;
    const problems = error.details.length > 0 ? error.details : [error.message];
    return failure(new InvoiceError("donnees_invalides", plainInvoiceProblems(problems)));
  }
}

function toInvoiceError(error: SaleInvoiceError): InvoiceError {
  return new InvoiceError(error.outcome === "incertaine" ? "abaninja_incertain" : "abaninja_echec", [error.message, ...error.details]);
}

async function saveCopy(sale: AbaNinjaSale, lines: InvoiceInput, document: SaleInvoiceDocument): Promise<Result<Invoice, InvoiceError>> {
  const number = document.number ?? document.reference;
  const pdfKey = invoicePdfKey(sale.shop, number);
  const contact = contactOf(sale.source.contact);
  try {
    const invoice = await prisma.$transaction(async (tx) => {
      await tx.storedFile.create({ data: { key: pdfKey, contentType: "application/pdf", bytes: new Uint8Array(document.pdf) } });
      return tx.invoice.create({
        data: {
          shop: sale.shop,
          orderId: sale.orderId,
          orderName: sale.source.order.name,
          number,
          issueDate: lines.issueDate,
          dueDate: lines.dueDate,
          totalCents: lines.totalCents,
          paidOn: null,
          customerName: lines.buyer.company ?? lines.buyer.name,
          customerEmail: contact.email,
          customerPhone: contact.phone,
          pdfKey,
        },
      });
    });
    return success(invoice);
  } catch (error) {
    logError("Facture AbaNinja faite mais non enregistrée dans l’app", error, { orderId: sale.orderId });
    return failure(new InvoiceError("abaninja_echec", [`La facture ${number} est faite dans AbaNinja, mais l’app n’a pas pu l’enregistrer.`, ERASE_HINT]));
  }
}

export async function ensureAbaNinjaTestInvoice(sale: AbaNinjaSale): Promise<Result<EnsuredInvoice, InvoiceError>> {
  const config = readAbaNinjaConfig();
  if (!config.ok) return failure(new InvoiceError("abaninja_echec", [config.error.message]));
  const lines = invoiceLinesOf(sale);
  if (!lines.ok) return lines;
  const plan = planTestSaleInvoice(lines.value, sale.now);
  if (!plan.ok) return failure(new InvoiceError("abaninja_echec", [plan.error.message]));
  const request = { shop: sale.shop, orderId: sale.orderId, orderName: sale.source.order.name, plan: plan.value };
  const made = await createTestSaleInvoice(config.value, request);
  if (!made.ok) return failure(toInvoiceError(made.error));
  const saved = await saveCopy(sale, lines.value, made.value);
  if (!saved.ok) return saved;
  logInfo("Facture AbaNinja prête dans l’app", { orderId: sale.orderId, number: saved.value.number });
  return success({ invoice: saved.value, created: true, inAbaNinja: true });
}
