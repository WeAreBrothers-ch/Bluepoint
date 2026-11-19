import type { AbaNinjaSale } from "@prisma/client";
import type { InvoiceInput } from "@bluepoint/facture-qr";
import { readAbaNinjaConfig, type AbaNinjaConfig } from "../abaninja/config.server";
import { todayInZurich } from "../abaninja/invoice-status";
import { getInvoice } from "../abaninja/invoices.server";
import { plannedDeliveryDate, saleNoteBody } from "../abaninja/vente-bon-plan";
import { convertSaleNote, resumeSaleInvoice, type SaleConversionRequest } from "../abaninja/vente-conversion.server";
import { RETRY_HINT, SALE_ERASE_HINT } from "../abaninja/vente-errors";
import { STALE_MS } from "../abaninja/vente-essai-resume";
import { paymentTypeOf } from "../abaninja/vente-paiement";
import { saleInvoiceBody } from "../abaninja/vente-plan";
import { logInfo } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import type { IsoDate } from "../metafields/definitions";
import { saveCopy, toInvoiceError, type AbaNinjaSaleContext } from "./abaninja-facture.server";
import { abaNinjaLinesOf } from "./abaninja-lines";
import type { EnsuredInvoice } from "./ensured";
import { InvoiceError } from "./errors";

/**
 * « J'ai livré » sur une commande d'essai dont le bon est dans AbaNinja : la facture naît du bon (qui devient
 * réglé), et l'app en garde une copie pour qu'Eliott l'envoie. Rien n'est envoyé à personne ici.
 */

export interface SalePaid {
  readonly paidOn: IsoDate;
  /** Moyen de paiement Shopify (« shopify_payments »…). */
  readonly gateway: string;
}

/**
 * Ce que l'état de la vente empêche, avec la marche à suivre ; null si la facture peut se faire (ou se reprendre).
 * « En cours » depuis plus de deux minutes : la fonction s'est arrêtée en route, la facture est peut-être faite.
 */
function blockedBy(sale: AbaNinjaSale, now: Date): InvoiceError | null {
  if (sale.invoiceState === "creee" && sale.invoiceUuid !== null) return null;
  if (sale.invoiceState === "en_cours" && now.getTime() - sale.updatedAt.getTime() < STALE_MS) {
    return new InvoiceError("abaninja_incertain", ["La facture de ce bon est déjà en train d’être faite. Attendez une minute, puis rechargez la page."]);
  }
  if (sale.invoiceState !== null) {
    return new InvoiceError("abaninja_incertain", [`La facture du bon de livraison est à vérifier dans AbaNinja (référence ${sale.reference}).`, SALE_ERASE_HINT]);
  }
  if (sale.noteState === "cree") return null;
  if (sale.noteState === "annule") return new InvoiceError("abaninja_echec", ["Le bon de livraison de cette commande est annulé dans AbaNinja : pas de facture."]);
  return new InvoiceError("abaninja_incertain", [`Le bon de livraison est à vérifier dans AbaNinja (référence ${sale.reference}) : la facture attend.`, SALE_ERASE_HINT]);
}

/**
 * Reprise d'une facture déjà née du bon : la date qu'elle a dans AbaNinja, pour ne pas la changer à chaque essai.
 * null (première fois, ou date illisible) : la date du jour, comme avant.
 */
async function originalIssueDate(config: AbaNinjaConfig, sale: AbaNinjaSale): Promise<IsoDate | null> {
  if (sale.invoiceState !== "creee" || sale.invoiceUuid === null) return null;
  const read = await getInvoice(config, sale.invoiceUuid);
  if (read.ok && read.value.invoiceDate !== null) return read.value.invoiceDate;
  logInfo("Facture du bon AbaNinja reprise : date d’origine illisible, date du jour gardée", { orderId: sale.orderId, cause: read.ok ? "date absente" : read.error.code });
  return null;
}

interface RequestParts {
  readonly sale: AbaNinjaSale;
  /** Lignes datées du jour de la facture (celui d'AbaNinja à la reprise, sinon aujourd'hui). */
  readonly lines: InvoiceInput;
  readonly ctx: AbaNinjaSaleContext;
  readonly paid: SalePaid | null;
  readonly datedFromAbaNinja: boolean;
}

function requestOf({ sale, lines, ctx, paid, datedFromAbaNinja }: RequestParts): Result<SaleConversionRequest, InvoiceError> {
  const noteDate = todayInZurich(sale.createdAt);
  const meta = { reference: sale.reference, orderName: sale.orderName };
  const note = saleNoteBody(lines, { ...meta, noteDate, deliveryDate: plannedDeliveryDate(ctx.deliveryDate, noteDate) });
  const invoice = saleInvoiceBody(lines, { ...meta, deliveryDate: ctx.deliveryDate });
  if (!note.ok) return failure(new InvoiceError("abaninja_echec", [note.error.message]));
  if (!invoice.ok) return failure(new InvoiceError("abaninja_echec", [invoice.error.message]));
  if (paid === null) return success({ sale, note: note.value, invoice: invoice.value, payment: null, datedFromAbaNinja });
  const payment = { amountChf: lines.totalCents / 100, paymentDate: paid.paidOn, paymentType: paymentTypeOf(paid.gateway), info: `Payée dans Shopify (${paid.gateway})` };
  return success({ sale, note: note.value, invoice: { ...invoice.value, terms: "Payée", dueDate: lines.issueDate }, payment, datedFromAbaNinja });
}

export async function ensureAbaNinjaSaleInvoice(sale: AbaNinjaSale, ctx: AbaNinjaSaleContext, paid: SalePaid | null): Promise<Result<EnsuredInvoice, InvoiceError>> {
  const blocked = blockedBy(sale, ctx.now);
  if (blocked !== null) return failure(blocked);
  const config = readAbaNinjaConfig();
  if (!config.ok) return failure(new InvoiceError("abaninja_echec", [config.error.message]));
  const original = await originalIssueDate(config.value, sale);
  const lines = abaNinjaLinesOf(ctx.source.order, ctx.settings, { issueDate: original ?? ctx.issueDate, deliveryDate: ctx.deliveryDate });
  if (!lines.ok) return lines;
  const request = requestOf({ sale, lines: lines.value, ctx, paid, datedFromAbaNinja: original !== null });
  if (!request.ok) return request;
  const made = sale.invoiceState === null ? await convertSaleNote(config.value, request.value) : await resumeSaleInvoice(config.value, request.value);
  if (!made.ok) return failure(toInvoiceError(made.error));
  const saved = await saveCopy(ctx, lines.value, made.value, { paidOn: paid?.paidOn ?? null, hint: RETRY_HINT });
  if (!saved.ok) return saved;
  logInfo("Facture AbaNinja née du bon prête dans l’app", { orderId: ctx.orderId, number: saved.value.invoice.number });
  return success({ ...saved.value, inAbaNinja: true, fromNote: true });
}
