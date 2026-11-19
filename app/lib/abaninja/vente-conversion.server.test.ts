import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateInvoiceInput } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";
import { saleNoteBody } from "./vente-bon-plan";
import { saleInvoiceBody } from "./vente-plan";
import type { AbaNinjaSale } from "./vente-repository.server";

const calls: string[] = [];
const deps = vi.hoisted(() => ({
  claimConversion: vi.fn(),
  markInvoice: vi.fn(),
  markNote: vi.fn(),
  markPayment: vi.fn(),
  listDeliveryNoteActionNames: vi.fn(),
  markDeliveryNoteSent: vi.fn(),
  updateDeliveryNote: vi.fn(),
  convertDeliveryNoteToInvoice: vi.fn(),
  findQrBankAccount: vi.fn(),
  updateInvoice: vi.fn(),
  recordPayment: vi.fn(),
  getInvoice: vi.fn(),
  downloadDraftInvoicePdf: vi.fn(),
  downloadInvoicePdf: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./vente-repository.server", () => ({
  claimConversion: deps.claimConversion,
  markInvoice: deps.markInvoice,
  markNote: deps.markNote,
  markPayment: deps.markPayment,
}));
vi.mock("./delivery-notes.server", () => ({
  listDeliveryNoteActionNames: deps.listDeliveryNoteActionNames,
  markDeliveryNoteSent: deps.markDeliveryNoteSent,
  updateDeliveryNote: deps.updateDeliveryNote,
  convertDeliveryNoteToInvoice: deps.convertDeliveryNoteToInvoice,
}));
vi.mock("./bank-accounts.server", () => ({ findQrBankAccount: deps.findQrBankAccount }));
vi.mock("./invoice-update.server", () => ({ updateInvoice: deps.updateInvoice }));
vi.mock("./payments.server", () => ({ recordPayment: deps.recordPayment }));
vi.mock("./invoices.server", () => ({ getInvoice: deps.getInvoice }));
vi.mock("./pdf-download.server", () => ({ downloadDraftInvoicePdf: deps.downloadDraftInvoicePdf, downloadInvoicePdf: deps.downloadInvoicePdf }));

const { convertSaleNote, resumeSaleInvoice } = await import("./vente-conversion.server");

const ORDER = "gid://shopify/Order/1042";
const NOTE = "66666666-6666-4666-8666-666666666666";
const INVOICE = "77777777-7777-4777-8777-777777777777";
const BANK = "11111111-1111-4111-8111-111111111111";
const RECEIVER = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
const REF = "BP-ESSAI-CMD-1042-20261119-110530";
const PDF = new Uint8Array([37, 80, 68, 70, 45]);
const INPUT = validateInvoiceInput(FACTURE_EXEMPLE);

const SALE: AbaNinjaSale = {
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

function body<T>(result: { ok: true; value: T } | { ok: false; error: Error }): T {
  if (!result.ok) throw result.error;
  return result.value;
}

const NOTE_BODY = body(saleNoteBody(INPUT, { reference: REF, orderName: "#1042", noteDate: "2026-11-19", deliveryDate: "2026-11-20" }));
const INVOICE_BODY = body(saleInvoiceBody(INPUT, { reference: REF, orderName: "#1042", deliveryDate: "2026-11-20" }));
const PAID = { amountChf: 1551, paymentDate: "2026-11-18", paymentType: "DEBIT_CREDIT_CARD" as const, info: "Payé en ligne (shopify_payments)" };

function request(payment: typeof PAID | null = null, sale: AbaNinjaSale = SALE) {
  return { sale, note: NOTE_BODY, invoice: INVOICE_BODY, payment };
}

function tracked<T>(name: string, value: T) {
  return vi.fn(async () => {
    calls.push(name);
    return value;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  deps.claimConversion.mockResolvedValue(success(true));
  deps.markInvoice.mockResolvedValue(success(SALE));
  deps.markNote.mockResolvedValue(success(SALE));
  deps.markPayment.mockResolvedValue(success(SALE));
  deps.listDeliveryNoteActionNames.mockResolvedValue(success(["convertDNI", "markSent", "cancel"]));
  deps.markDeliveryNoteSent.mockImplementation(tracked("markSent", success(undefined)));
  deps.updateDeliveryNote.mockImplementation(tracked("bon", success(undefined)));
  deps.convertDeliveryNoteToInvoice.mockImplementation(tracked("convertDNI", success(INVOICE)));
  deps.findQrBankAccount.mockResolvedValue(success({ uuid: BANK, name: "Compte QR" }));
  deps.updateInvoice.mockImplementation(tracked("facture", success(undefined)));
  deps.recordPayment.mockImplementation(tracked("paiement", success(undefined)));
  deps.getInvoice.mockResolvedValue(success({ uuid: INVOICE, status: "draft", systemInvoiceNumber: "R02292", reference: REF }));
  deps.downloadDraftInvoicePdf.mockImplementation(tracked("apercu", success(PDF)));
  deps.downloadInvoicePdf.mockImplementation(tracked("pdf", success(PDF)));
});

describe("« J'ai livré » : le bon de livraison devient la facture AbaNinja", () => {
  it("à payer : remet le bon à jour, le transforme, complète la facture, puis rapporte son aperçu", async () => {
    const result = await convertSaleNote(testConfig(), request());
    expect(result).toEqual({ ok: true, value: { uuid: INVOICE, number: "R02292", reference: REF, pdf: PDF } });
    expect(calls).toEqual(["bon", "convertDNI", "facture", "apercu"]);
    expect(deps.updateDeliveryNote).toHaveBeenCalledWith(expect.anything(), NOTE, { ...NOTE_BODY, receiver: RECEIVER }, {});
    expect(deps.updateInvoice).toHaveBeenCalledWith(expect.anything(), INVOICE, { ...INVOICE_BODY, receiver: RECEIVER, bankAccountUuid: BANK }, {});
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "converti" });
    expect(deps.markInvoice).toHaveBeenLastCalledWith(ORDER, { state: "creee", invoiceUuid: INVOICE, invoiceNumber: "R02292" });
    expect(deps.recordPayment).not.toHaveBeenCalled();
  });

  it("payée en ligne : inscrit le paiement puis rapporte le vrai document, jamais l'aperçu à QR", async () => {
    const result = await convertSaleNote(testConfig(), request(PAID));
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["bon", "convertDNI", "facture", "paiement", "pdf"]);
    expect(deps.recordPayment).toHaveBeenCalledWith(expect.anything(), { documentUuid: INVOICE, ...PAID }, {});
    expect(deps.markPayment).toHaveBeenLastCalledWith(ORDER, "inscrit");
    expect(deps.downloadDraftInvoicePdf).not.toHaveBeenCalled();
  });

  it("une seule facture même si « J'ai livré » et Shopify arrivent ensemble", async () => {
    deps.claimConversion.mockResolvedValue(success(false));
    const result = await convertSaleNote(testConfig(), request());
    expect(result).toMatchObject({ ok: false, error: { message: "La facture de ce bon est déjà faite ou en train de l’être." } });
    expect(calls).toEqual([]);
  });

  it("résultat incertain de la transformation : jamais redemandée, marquée à vérifier", async () => {
    deps.convertDeliveryNoteToInvoice.mockImplementation(tracked("convertDNI", failure(new AbaNinjaError("indisponible", { status: 503 }))));
    const result = await convertSaleNote(testConfig(), request());
    expect(result).toMatchObject({ ok: false, error: { outcome: "incertaine" } });
    expect(deps.convertDeliveryNoteToInvoice).toHaveBeenCalledTimes(1);
    expect(deps.markInvoice).toHaveBeenCalledWith(ORDER, { state: "incertaine", errorCode: "indisponible" });
  });

  it("transformation refusée : rien n'est fait, la réservation est rendue", async () => {
    deps.convertDeliveryNoteToInvoice.mockImplementation(tracked("convertDNI", failure(new AbaNinjaError("donnees_refusees", { status: 422 }))));
    expect(await convertSaleNote(testConfig(), request())).toMatchObject({ ok: false, error: { outcome: "refusee" } });
    expect(deps.markInvoice).toHaveBeenCalledWith(ORDER, { state: "refusee", errorCode: "donnees_refusees" });
    expect(deps.markNote).not.toHaveBeenCalled();
  });

  it("bon pas transformable en brouillon : il est d'abord marqué envoyé", async () => {
    deps.listDeliveryNoteActionNames.mockResolvedValue(success(["markSent", "cancel"]));
    await convertSaleNote(testConfig(), request());
    expect(calls.slice(0, 3)).toEqual(["bon", "markSent", "convertDNI"]);
  });

  it("paiement non inscrit : marqué à vérifier avant l'envoi, aucun PDF", async () => {
    deps.recordPayment.mockImplementation(tracked("paiement", failure(new AbaNinjaError("indisponible", { status: 503 }))));
    const result = await convertSaleNote(testConfig(), request(PAID));
    expect(result).toMatchObject({ ok: false, error: { outcome: "incertaine" } });
    expect(deps.markPayment).toHaveBeenCalledWith(ORDER, "incertain");
    expect(deps.markPayment).not.toHaveBeenCalledWith(ORDER, "inscrit");
    expect(deps.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(deps.downloadDraftInvoicePdf).not.toHaveBeenCalled();
  });

  it("vrai PDF refusé pour une facture payée : dit où le trouver", async () => {
    deps.downloadInvoicePdf.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    const result = await convertSaleNote(testConfig(), request(PAID));
    expect(result).toMatchObject({ ok: false, error: { message: "Facture R02292 faite et payée dans AbaNinja : téléchargez son PDF depuis AbaNinja." } });
  });
});

describe("reprendre une facture déjà née du bon (PDF manqué la première fois)", () => {
  const made: AbaNinjaSale = { ...SALE, noteState: "converti", invoiceState: "creee", invoiceUuid: INVOICE };

  it("ne retransforme jamais le bon : complète et rapporte la facture existante", async () => {
    const result = await resumeSaleInvoice(testConfig(), request(null, made));
    expect(result.ok).toBe(true);
    expect(deps.convertDeliveryNoteToInvoice).not.toHaveBeenCalled();
    expect(calls).toEqual(["facture", "apercu"]);
  });

  it("n'inscrit pas deux fois un paiement déjà inscrit", async () => {
    await resumeSaleInvoice(testConfig(), request(PAID, { ...made, paymentState: "inscrit" }));
    expect(deps.recordPayment).not.toHaveBeenCalled();
    expect(calls).toEqual(["facture", "pdf"]);
  });

  it("s'arrête sur un paiement à vérifier", async () => {
    const result = await resumeSaleInvoice(testConfig(), request(PAID, { ...made, paymentState: "incertain" }));
    expect(result).toMatchObject({ ok: false, error: { outcome: "incertaine" } });
    expect(deps.recordPayment).not.toHaveBeenCalled();
  });
});
