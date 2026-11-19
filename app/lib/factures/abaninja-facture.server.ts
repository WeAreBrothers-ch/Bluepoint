import { Prisma } from "@prisma/client";
import type { InvoiceInput } from "@bluepoint/facture-qr";
import prisma from "../../db.server";
import { readAbaNinjaConfig } from "../abaninja/config.server";
import { ERASE_HINT, type SaleInvoiceError } from "../abaninja/vente-errors";
import { createTestSaleInvoice, type SaleInvoiceDocument } from "../abaninja/vente-facture.server";
import { planTestSaleInvoice } from "../abaninja/vente-plan";
import { logError, logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import type { IsoDate } from "../metafields/definitions";
import type { ShopSettingsValues } from "../reglages/schema";
import type { OrderGid } from "../shopify/ids";
import { abaNinjaLinesOf } from "./abaninja-lines";
import { contactOf } from "./delivery-date";
import type { EnsuredInvoice } from "./ensured";
import { InvoiceError } from "./errors";
import { findInvoiceByOrder, invoicePdfKey, type Invoice } from "./repository.server";
import type { OrderForInvoice } from "./shopify-order.server";

/**
 * Facture d'une commande d'essai (étiquetée « fictif ») : elle se fait dans AbaNinja, et l'app en garde
 * une copie (numéro AbaNinja et PDF) pour qu'Eliott l'envoie avec les boutons habituels. Les vraies
 * commandes restent sur les factures BluePoint tant qu'AbaNinja n'est pas allumé pour elles.
 */

export interface AbaNinjaSaleContext {
  readonly shop: string;
  readonly orderId: OrderGid;
  readonly source: OrderForInvoice;
  readonly settings: ShopSettingsValues;
  readonly deliveryDate: IsoDate;
  readonly issueDate: IsoDate;
  readonly now: Date;
}

/** Mêmes lignes, même TVA et même total que la facture BluePoint de cette commande. */
function invoiceLinesOf(sale: AbaNinjaSaleContext): Result<InvoiceInput, InvoiceError> {
  return abaNinjaLinesOf(sale.source.order, sale.settings, { issueDate: sale.issueDate, deliveryDate: sale.deliveryDate });
}

export function toInvoiceError(error: SaleInvoiceError): InvoiceError {
  return new InvoiceError(error.outcome === "incertaine" ? "abaninja_incertain" : "abaninja_echec", [error.message, ...error.details]);
}

export interface CopyOptions {
  /** Jour du paiement d'une commande déjà payée (facture acquittée). */
  readonly paidOn: IsoDate | null;
  /** Marche à suivre si la copie ne s'enregistre pas. */
  readonly hint: string;
}

export interface SavedCopy {
  readonly invoice: Invoice;
  /** Faux : une autre action partie en même temps (bouton, livraison Shopify) l'avait déjà enregistrée. */
  readonly created: boolean;
}

/**
 * La copie de CETTE facture enregistrée par l'action gagnante d'une course (contrainte d'unicité) ; null si ce
 * n'en est pas une (autre facture de la commande, BluePoint par exemple : l'échec est dit, jamais caché).
 */
async function copyOfRace(sale: AbaNinjaSaleContext, number: string, error: unknown): Promise<Invoice | null> {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  try {
    const existing = await findInvoiceByOrder(sale.orderId);
    return existing !== null && existing.shop === sale.shop && existing.number === number ? existing : null;
  } catch (thrown) {
    logError("Copie de facture AbaNinja illisible après un doublon", thrown, { orderId: sale.orderId });
    return null;
  }
}

/** Copie de la facture AbaNinja dans l'app (numéro AbaNinja, PDF), pour qu'Eliott l'envoie avec les boutons habituels. */
export async function saveCopy(
  sale: AbaNinjaSaleContext,
  lines: InvoiceInput,
  document: SaleInvoiceDocument,
  options: CopyOptions = { paidOn: null, hint: ERASE_HINT },
): Promise<Result<SavedCopy, InvoiceError>> {
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
          dueDate: options.paidOn === null ? lines.dueDate : lines.issueDate,
          totalCents: lines.totalCents,
          paidOn: options.paidOn,
          customerName: lines.buyer.company ?? lines.buyer.name,
          customerEmail: contact.email,
          customerPhone: contact.phone,
          pdfKey,
        },
      });
    });
    return success({ invoice, created: true });
  } catch (error) {
    const existing = await copyOfRace(sale, number, error);
    if (existing !== null) return success({ invoice: existing, created: false });
    logError("Facture AbaNinja faite mais non enregistrée dans l’app", error, { orderId: sale.orderId });
    return failure(new InvoiceError("abaninja_echec", [`La facture ${number} est faite dans AbaNinja, mais l’app n’a pas pu l’enregistrer.`, options.hint]));
  }
}

export async function ensureAbaNinjaTestInvoice(sale: AbaNinjaSaleContext): Promise<Result<EnsuredInvoice, InvoiceError>> {
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
  logInfo("Facture AbaNinja prête dans l’app", { orderId: sale.orderId, number: saved.value.invoice.number });
  return success({ ...saved.value, inAbaNinja: true });
}
