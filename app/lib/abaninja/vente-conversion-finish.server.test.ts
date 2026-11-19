import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";
import { BANK, callRecorder, INVOICE, MADE, ORDER, PAID, PDF, REF, request } from "./vente-conversion.test-support";

const deps = vi.hoisted(() => ({
  markInvoice: vi.fn(),
  markPayment: vi.fn(),
  claimPayment: vi.fn(),
  releasePayment: vi.fn(),
  findQrBankAccount: vi.fn(),
  updateInvoice: vi.fn(),
  recordPayment: vi.fn(),
  getInvoice: vi.fn(),
  downloadDraftInvoicePdf: vi.fn(),
  downloadInvoicePdf: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./vente-repository.server", () => ({
  markInvoice: deps.markInvoice,
  markPayment: deps.markPayment,
  claimPayment: deps.claimPayment,
  releasePayment: deps.releasePayment,
}));
vi.mock("./bank-accounts.server", () => ({ findQrBankAccount: deps.findQrBankAccount }));
vi.mock("./invoice-update.server", () => ({ updateInvoice: deps.updateInvoice }));
vi.mock("./payments.server", () => ({ recordPayment: deps.recordPayment }));
vi.mock("./invoices.server", () => ({ getInvoice: deps.getInvoice }));
vi.mock("./pdf-download.server", () => ({ downloadDraftInvoicePdf: deps.downloadDraftInvoicePdf, downloadInvoicePdf: deps.downloadInvoicePdf }));

const { finishSaleInvoice } = await import("./vente-conversion-finish.server");

const { calls, tracked } = callRecorder();

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  deps.markInvoice.mockResolvedValue(success(MADE));
  deps.markPayment.mockResolvedValue(success(MADE));
  let paymentClaimed = false;
  deps.claimPayment.mockImplementation(async () => {
    const won = !paymentClaimed;
    paymentClaimed = true;
    return success(won);
  });
  deps.releasePayment.mockResolvedValue(success(true));
  deps.findQrBankAccount.mockResolvedValue(success({ uuid: BANK, name: "Compte QR" }));
  deps.updateInvoice.mockImplementation(tracked("facture", success(undefined)));
  deps.recordPayment.mockImplementation(tracked("paiement", success(undefined)));
  deps.getInvoice.mockResolvedValue(success({ uuid: INVOICE, status: "draft", systemInvoiceNumber: "R02292", reference: REF }));
  deps.downloadDraftInvoicePdf.mockImplementation(tracked("apercu", success(PDF)));
  deps.downloadInvoicePdf.mockImplementation(tracked("pdf", success(PDF)));
});

describe("compléter la facture née du bon : paiement et PDF", () => {
  it("payée en ligne : inscrit le paiement puis rapporte le vrai document, jamais l'aperçu à QR", async () => {
    const result = await finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE);
    expect(result).toEqual({ ok: true, value: { uuid: INVOICE, number: "R02292", reference: REF, pdf: PDF } });
    expect(calls).toEqual(["facture", "paiement", "pdf"]);
    expect(deps.recordPayment).toHaveBeenCalledWith(expect.anything(), { documentUuid: INVOICE, ...PAID }, {});
    expect(deps.markPayment).toHaveBeenLastCalledWith(ORDER, "inscrit");
    expect(deps.downloadDraftInvoicePdf).not.toHaveBeenCalled();
  });

  it("paiement non inscrit : marqué à vérifier avant l'envoi, aucun PDF", async () => {
    deps.recordPayment.mockImplementation(tracked("paiement", failure(new AbaNinjaError("indisponible", { status: 503 }))));
    const result = await finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE);
    expect(result).toMatchObject({ ok: false, error: { outcome: "incertaine" } });
    expect(deps.claimPayment).toHaveBeenCalledWith(ORDER);
    expect(deps.releasePayment).not.toHaveBeenCalled();
    expect(deps.markPayment).not.toHaveBeenCalled();
    expect(deps.downloadInvoicePdf).not.toHaveBeenCalled();
    expect(deps.downloadDraftInvoicePdf).not.toHaveBeenCalled();
  });

  it("« J'ai livré » et le webhook de livraison ensemble : un seul paiement inscrit", async () => {
    const results = await Promise.all([
      finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE),
      finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE),
    ]);
    expect(deps.recordPayment).toHaveBeenCalledTimes(1);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it("paiement refusé par AbaNinja : la réservation est rendue et la raison est dite", async () => {
    deps.recordPayment.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    const result = await finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE);
    expect(result).toMatchObject({ ok: false, error: { outcome: "refusee", message: "AbaNinja a refusé d’inscrire le paiement de la facture R02292." } });
    expect(deps.releasePayment).toHaveBeenCalledWith(ORDER);
    expect(deps.downloadInvoicePdf).not.toHaveBeenCalled();
  });

  it("facture déjà payée dans AbaNinja (inscrite à la main) : rien n'est inscrit une deuxième fois", async () => {
    deps.getInvoice.mockResolvedValue(success({ uuid: INVOICE, status: "paid", openAmount: 0, dueDate: null, systemInvoiceNumber: "R02292", reference: REF }));
    const result = await finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE);
    expect(result.ok).toBe(true);
    expect(deps.recordPayment).not.toHaveBeenCalled();
    expect(deps.claimPayment).not.toHaveBeenCalled();
    expect(deps.markPayment).toHaveBeenCalledWith(ORDER, "inscrit");
  });

  it("vrai PDF refusé pour une facture payée : dit où le trouver", async () => {
    deps.downloadInvoicePdf.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    const result = await finishSaleInvoice(testConfig(), request(PAID, MADE), INVOICE);
    expect(result).toMatchObject({ ok: false, error: { message: "Facture R02292 faite et payée dans AbaNinja : téléchargez son PDF depuis AbaNinja." } });
  });

  it("reprise après paiement inscrit : ni nouveau paiement, ni nouvelle mise à jour de la facture", async () => {
    await finishSaleInvoice(testConfig(), request(PAID, { ...MADE, paymentState: "inscrit" }), INVOICE);
    expect(deps.recordPayment).not.toHaveBeenCalled();
    expect(deps.updateInvoice).not.toHaveBeenCalled();
    expect(calls).toEqual(["pdf"]);
  });

  it("à payer, reprise avec numéro noté et date d'origine lue : pas de mise à jour, l'aperçu garde la date d'origine", async () => {
    const resumed = { ...request(null, { ...MADE, invoiceNumber: "R02292" }), datedFromAbaNinja: true };
    expect(await finishSaleInvoice(testConfig(), resumed, INVOICE)).toMatchObject({ ok: true });
    expect(deps.updateInvoice).not.toHaveBeenCalled();
    expect(deps.downloadDraftInvoicePdf).toHaveBeenCalledWith(expect.anything(), INVOICE, expect.objectContaining({ invoiceDate: resumed.invoice.invoiceDate }), {});
  });

  it("faite à payer, payée en ligne avant la reprise : remise à jour (conditions de la payée) avant d'inscrire le paiement", async () => {
    const resumed = { ...request(PAID, { ...MADE, invoiceNumber: "R02292" }), datedFromAbaNinja: true };
    await finishSaleInvoice(testConfig(), resumed, INVOICE);
    expect(deps.updateInvoice).toHaveBeenCalledWith(expect.anything(), INVOICE, expect.objectContaining({ terms: resumed.invoice.terms }), {});
    expect(calls).toEqual(["facture", "paiement", "pdf"]);
  });

  it("numéro illisible à la reprise : le numéro déjà noté est gardé, jamais effacé", async () => {
    deps.getInvoice.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    await finishSaleInvoice(testConfig(), request(null, { ...MADE, invoiceNumber: "R02292" }), INVOICE);
    expect(deps.markInvoice).toHaveBeenCalledWith(ORDER, { state: "creee", invoiceUuid: INVOICE, invoiceNumber: "R02292" });
  });

  it("à payer, reprise avec numéro noté mais date illisible : remise à jour comme avant (aperçu et AbaNinja à la même date)", async () => {
    await finishSaleInvoice(testConfig(), request(null, { ...MADE, invoiceNumber: "R02292" }), INVOICE);
    expect(calls).toEqual(["facture", "apercu"]);
  });

  it("s'arrête sur un paiement à vérifier", async () => {
    const result = await finishSaleInvoice(testConfig(), request(PAID, { ...MADE, paymentState: "incertain" }), INVOICE);
    expect(result).toMatchObject({ ok: false, error: { outcome: "incertaine" } });
    expect(deps.recordPayment).not.toHaveBeenCalled();
  });
});
