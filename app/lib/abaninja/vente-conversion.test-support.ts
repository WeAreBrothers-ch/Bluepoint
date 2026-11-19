import { vi } from "vitest";
import { validateInvoiceInput } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import type { Result } from "../core/result";
import { saleNoteBody } from "./vente-bon-plan";
import type { SaleConversionRequest, SalePayment } from "./vente-conversion-finish.server";
import { saleInvoiceBody } from "./vente-plan";
import type { AbaNinjaSale } from "./vente-repository.server";

/** Une commande d'essai #1042 dont le bon est fait, prête pour « J'ai livré » (tests de la conversion). */

export const ORDER = "gid://shopify/Order/1042";
export const NOTE = "66666666-6666-4666-8666-666666666666";
export const INVOICE = "77777777-7777-4777-8777-777777777777";
export const BANK = "11111111-1111-4111-8111-111111111111";
export const RECEIVER = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
export const REF = "BP-ESSAI-CMD-1042-20261119-110530";
export const PDF = new Uint8Array([37, 80, 68, 70, 45]);

export const SALE: AbaNinjaSale = {
  id: "v1",
  shop: "test.myshopify.com",
  orderId: ORDER,
  orderName: "#1042",
  isTest: true,
  reference: REF,
  noteState: "cree",
  noteUuid: NOTE,
  noteNumber: "L00042",
  ...RECEIVER,
  invoiceState: null,
  invoiceUuid: null,
  invoiceNumber: null,
  paymentState: null,
  lastErrorCode: null,
  createdAt: new Date("2026-11-19T11:05:30Z"),
  updatedAt: new Date("2026-11-19T11:05:30Z"),
};

/** La même vente, une fois sa facture née du bon. */
export const MADE: AbaNinjaSale = { ...SALE, noteState: "converti", invoiceState: "creee", invoiceUuid: INVOICE };

function valueOf<T>(result: Result<T, Error>): T {
  if (!result.ok) throw result.error;
  return result.value;
}

const INPUT = validateInvoiceInput(FACTURE_EXEMPLE);
export const NOTE_BODY = valueOf(saleNoteBody(INPUT, { reference: REF, orderName: "#1042", noteDate: "2026-11-19", deliveryDate: "2026-11-20" }));
export const INVOICE_BODY = valueOf(saleInvoiceBody(INPUT, { reference: REF, orderName: "#1042", deliveryDate: "2026-11-20" }));
export const PAID: SalePayment = { amountChf: 1551, paymentDate: "2026-11-18", paymentType: "DEBIT_CREDIT_CARD", info: "Payée dans Shopify (shopify_payments)" };

export function request(payment: SalePayment | null = null, sale: AbaNinjaSale = SALE): SaleConversionRequest {
  return { sale, note: NOTE_BODY, invoice: INVOICE_BODY, payment, datedFromAbaNinja: false };
}

/** Ordre des appels à AbaNinja : chaque faux appel note son nom dans `calls`. */
export function callRecorder() {
  const calls: string[] = [];
  const tracked = <T>(name: string, value: T) =>
    vi.fn(async () => {
      calls.push(name);
      return value;
    });
  return { calls, tracked };
}
