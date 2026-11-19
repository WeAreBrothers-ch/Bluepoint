import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";
import { BANK, callRecorder, INVOICE, INVOICE_BODY, MADE, NOTE, NOTE_BODY, ORDER, PDF, RECEIVER, REF, SALE, request } from "./vente-conversion.test-support";

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

const { calls, tracked } = callRecorder();

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
});

describe("reprendre une facture déjà née du bon (PDF manqué la première fois)", () => {
  it("ne retransforme jamais le bon : complète et rapporte la facture existante", async () => {
    const result = await resumeSaleInvoice(testConfig(), request(null, MADE));
    expect(result.ok).toBe(true);
    expect(deps.convertDeliveryNoteToInvoice).not.toHaveBeenCalled();
    expect(calls).toEqual(["facture", "apercu"]);
  });
});
