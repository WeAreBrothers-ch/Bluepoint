import type { AbaNinjaSale } from "@prisma/client";
import type { Mock } from "vitest";
import { success } from "../core/result";

/** Un essai #1035 (bon devenu facture) et les réponses habituelles d'AbaNinja, pour les tests de l'effacement. */

export const NOW = new Date("2026-11-19T15:00:00Z");
export const NOTE = "66666666-6666-4666-8666-666666666666";
export const INVOICE = "77777777-7777-4777-8777-777777777777";
export const COMPANY = "33333333-3333-4333-8333-333333333333";
export const REF = "BP-ESSAI-CMD-1035-20261119-110530";
/** Le nom du client d'essai tel qu'il apparaît dans AbaNinja (fin de la référence). */
export const CLIENT = "le client « … essai BluePoint 20261119-110530 (à supprimer) »";

export function sale(changes: Partial<AbaNinjaSale> = {}): AbaNinjaSale {
  return {
    id: "v1",
    shop: "test.myshopify.com",
    orderId: "gid://shopify/Order/1035",
    orderName: "#1035",
    isTest: true,
    reference: REF,
    noteState: "converti",
    noteUuid: NOTE,
    noteNumber: "L00042",
    addressUuid: "22222222-2222-4222-8222-222222222222",
    companyUuid: COMPANY,
    invoiceState: "creee",
    invoiceUuid: INVOICE,
    invoiceNumber: "R02292",
    paymentState: null,
    lastErrorCode: null,
    createdAt: new Date("2026-11-19T11:05:30Z"),
    updatedAt: new Date("2026-11-19T11:05:30Z"),
    ...changes,
  };
}

export const NO_INVOICE = { invoiceState: null, invoiceUuid: null, invoiceNumber: null };

export function invoice(status: string, reference = REF) {
  return success({ uuid: INVOICE, status, sentStatus: null, openAmount: 1551, dueDate: "2026-12-19", systemInvoiceNumber: "R02292", reference, isCancelled: false, companyUuid: COMPANY });
}

export interface EraseApi {
  readonly listTestSales: Mock;
  readonly getInvoice: Mock;
  readonly deleteInvoice: Mock;
  readonly getDeliveryNote: Mock;
  readonly deleteDeliveryNote: Mock;
  readonly deleteCompany: Mock;
}

export interface EraseTx {
  readonly invoice: { readonly findFirst: Mock; readonly delete: Mock };
  readonly storedFile: { readonly deleteMany: Mock };
  readonly abaNinjaSale: { readonly deleteMany: Mock };
}

/** Tout s'efface sans accroc : brouillon à la bonne référence, bon réglé, client libre, copie dans l'app. */
export function answerAsUsual(api: EraseApi, tx: EraseTx): void {
  api.listTestSales.mockResolvedValue(success([sale()]));
  api.getInvoice.mockResolvedValue(invoice("draft"));
  api.deleteInvoice.mockResolvedValue(success(undefined));
  api.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "converted", reference: REF, number: "L00042", companyUuid: COMPANY }));
  api.deleteDeliveryNote.mockResolvedValue(success(undefined));
  api.deleteCompany.mockResolvedValue(success(undefined));
  tx.invoice.findFirst.mockResolvedValue({ id: "copie-2", pdfKey: "test.myshopify.com/R02292.pdf" });
}
