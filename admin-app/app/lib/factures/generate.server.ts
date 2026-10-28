import { Prisma } from "@prisma/client";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { FactureError, mapShopifyOrderToInvoiceInput, renderInvoicePdf } from "@bluepoint/facture-qr";
import prisma from "../../db.server";
import { swissIsoDate } from "../agenda/dates";
import { failure, success, type Result } from "../core/result";
import { logError, logInfo } from "../core/logger.server";
import type { IsoDate } from "../metafields/definitions";
import { toInvoiceSeller } from "../reglages/seller";
import { loadCompleteSettings } from "../reglages/settings.server";
import type { ShopSettingsValues } from "../reglages/schema";
import type { OrderGid } from "../shopify/ids";
import { contactOf, deliveryDateOf } from "./delivery-date";
import { InvoiceError } from "./errors";
import { formatInvoiceNumber, yearOfIsoDate } from "./numbering";
import { nextInvoiceSequence } from "./numbering.server";
import { findInvoiceByOrder, invoicePdfKey, type Invoice } from "./repository.server";
import { fetchOrderForInvoice, type OrderForInvoice } from "./shopify-order.server";

/**
 * Crée la facture d'une commande livrée, ou le reçu pro (facture acquittée) d'une commande payée,
 * une seule fois : si elle existe déjà, on la renvoie. Numéro, PDF et enregistrement se font
 * dans une seule transaction.
 */

export interface EnsuredInvoice {
  readonly invoice: Invoice;
  readonly created: boolean;
}

interface Draft {
  readonly shop: string;
  readonly orderId: OrderGid;
  readonly source: OrderForInvoice;
  readonly settings: ShopSettingsValues;
  readonly deliveryDate: IsoDate;
  readonly issueDate: IsoDate;
  /** Date de paiement d'un reçu pro (facture acquittée, sans QR-facture), sinon null. */
  readonly paidOn: IsoDate | null;
}

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

function paymentTermsText(days: number): string | undefined {
  return days === 0 ? "Payable à réception" : undefined;
}

async function createInvoice(draft: Draft): Promise<Invoice> {
  return prisma.$transaction(async (tx) => {
    const year = yearOfIsoDate(draft.issueDate);
    const number = formatInvoiceNumber(year, await nextInvoiceSequence(tx, draft.shop, year));
    const terms = paymentTermsText(draft.settings.paymentTermDays);
    const input = mapShopifyOrderToInvoiceInput(draft.source.order, toInvoiceSeller(draft.settings), {
      invoiceNumber: number,
      issueDate: draft.issueDate,
      deliveryDate: draft.deliveryDate,
      paymentTermDays: draft.settings.paymentTermDays,
      ...(draft.paidOn === null ? {} : { paidOn: draft.paidOn }),
      ...(terms === undefined || draft.paidOn !== null ? {} : { paymentTerms: terms }),
    });
    const pdf = await renderInvoicePdf(input);
    const pdfKey = invoicePdfKey(draft.shop, number);
    await tx.storedFile.create({ data: { key: pdfKey, contentType: "application/pdf", bytes: new Uint8Array(pdf) } });
    const contact = contactOf(draft.source.contact);
    return tx.invoice.create({
      data: {
        shop: draft.shop,
        orderId: draft.orderId,
        orderName: draft.source.order.name,
        number,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        totalCents: input.totalCents,
        paidOn: draft.paidOn,
        customerName: input.buyer.company ?? input.buyer.name,
        customerEmail: contact.email,
        customerPhone: contact.phone,
        pdfKey,
      },
    });
  }, TRANSACTION_OPTIONS);
}

function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function createOrRecover(draft: Draft): Promise<Result<EnsuredInvoice, InvoiceError>> {
  try {
    const invoice = await createInvoice(draft);
    logInfo("Facture créée", { orderId: draft.orderId, number: invoice.number });
    return success({ invoice, created: true });
  } catch (error) {
    if (isDuplicate(error)) {
      const existing = await findInvoiceByOrder(draft.orderId);
      if (existing !== null) return success({ invoice: existing, created: false });
    }
    if (error instanceof FactureError) {
      return failure(new InvoiceError("donnees_invalides", error.details.length > 0 ? error.details : [error.message]));
    }
    logError("Création de facture impossible", error, { orderId: draft.orderId });
    return failure(new InvoiceError("erreur_interne"));
  }
}

export async function ensureInvoice(
  admin: AdminApiContext,
  shop: string,
  orderId: OrderGid,
  now: Date = new Date(),
): Promise<Result<EnsuredInvoice, InvoiceError>> {
  try {
    const existing = await findInvoiceByOrder(orderId);
    if (existing !== null) return success({ invoice: existing, created: false });
    const settings = await loadCompleteSettings(shop);
    if (settings === null) return failure(new InvoiceError("reglages_incomplets"));
    const source = await fetchOrderForInvoice(admin, orderId);
    if (!source.ok) return source;
    const deliveryDate = deliveryDateOf(source.value.contact.fulfillments);
    if (deliveryDate === null) return failure(new InvoiceError("commande_non_livree"));
    return await createOrRecover({ shop, orderId, source: source.value, settings, deliveryDate, issueDate: swissIsoDate(now), paidOn: null });
  } catch (error) {
    logError("Préparation de la facture impossible", error, { orderId });
    return failure(new InvoiceError("erreur_interne"));
  }
}

/**
 * Reçu pro d'une commande payée en ligne : facture acquittée, datée du jour du paiement.
 * La commande n'est pas encore livrée : la date de livraison est celle que le client a choisie
 * au panier, à défaut le jour du paiement.
 */
export async function ensureReceipt(
  admin: AdminApiContext,
  shop: string,
  orderId: OrderGid,
  plannedDeliveryDate: IsoDate | null,
  now: Date = new Date(),
): Promise<Result<EnsuredInvoice, InvoiceError>> {
  try {
    const existing = await findInvoiceByOrder(orderId);
    if (existing !== null) return success({ invoice: existing, created: false });
    const settings = await loadCompleteSettings(shop);
    if (settings === null) return failure(new InvoiceError("reglages_incomplets"));
    const source = await fetchOrderForInvoice(admin, orderId);
    if (!source.ok) return source;
    const today = swissIsoDate(now);
    const draft: Draft = { shop, orderId, source: source.value, settings, deliveryDate: plannedDeliveryDate ?? today, issueDate: today, paidOn: today };
    return await createOrRecover(draft);
  } catch (error) {
    logError("Préparation du reçu pro impossible", error, { orderId });
    return failure(new InvoiceError("erreur_interne"));
  }
}
