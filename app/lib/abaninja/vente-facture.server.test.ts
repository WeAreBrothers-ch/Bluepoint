import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateInvoiceInput } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { CreateInvoiceError } from "./invoice-errors";
import { testConfig } from "./test-support";
import { planTestSaleInvoice } from "./vente-plan";

const api = vi.hoisted(() => ({
  findQrBankAccount: vi.fn(),
  createAddress: vi.fn(),
  createInvoice: vi.fn(),
  downloadDraftInvoicePdf: vi.fn(),
  deleteCompany: vi.fn(),
}));
const lock = vi.hoisted(() => ({
  claimInvoiceSlot: vi.fn(),
  releaseRefused: vi.fn(),
  markCreated: vi.fn(),
  markRefused: vi.fn(),
  markUncertain: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./bank-accounts.server", () => ({ findQrBankAccount: api.findQrBankAccount }));
vi.mock("./addresses.server", () => ({ createAddress: api.createAddress }));
vi.mock("./invoices.server", () => ({ createInvoice: api.createInvoice }));
vi.mock("./pdf-download.server", () => ({ downloadDraftInvoicePdf: api.downloadDraftInvoicePdf }));
vi.mock("./invoice-cleanup.server", () => ({ deleteCompany: api.deleteCompany }));
vi.mock("./repository.server", () => lock);

const { createTestSaleInvoice } = await import("./vente-facture.server");

const ORDER_ID = "gid://shopify/Order/1042";
const BANK = "11111111-1111-4111-8111-111111111111";
const ADDRESS = "22222222-2222-4222-8222-222222222222";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const INVOICE = "44444444-4444-4444-8444-444444444444";
const PDF = new Uint8Array([37, 80, 68, 70, 45]);

const plan = (() => {
  const result = planTestSaleInvoice(validateInvoiceInput(FACTURE_EXEMPLE), new Date("2026-11-19T11:05:30Z"));
  if (!result.ok) throw result.error;
  return result.value;
})();

function row(state: string) {
  return { orderId: ORDER_ID, state, reference: "BP-ESSAI-FACT-1042-20261119-100000", systemInvoiceNumber: "R02290" };
}

function run() {
  return createTestSaleInvoice(testConfig(), { shop: "test.myshopify.com", orderId: ORDER_ID, orderName: "#1042", plan });
}

beforeEach(() => {
  vi.clearAllMocks();
  lock.claimInvoiceSlot.mockResolvedValue(success({ invoice: row("en_cours"), claimed: true }));
  for (const mark of [lock.markCreated, lock.markRefused, lock.markUncertain, lock.releaseRefused]) mark.mockResolvedValue(success(row("x")));
  api.findQrBankAccount.mockResolvedValue(success({ uuid: BANK, name: "QR" }));
  api.createAddress.mockResolvedValue(success({ addressUuid: ADDRESS, companyUuid: COMPANY }));
  api.createInvoice.mockResolvedValue(success({ uuid: INVOICE, systemInvoiceNumber: "R02291" }));
  api.downloadDraftInvoicePdf.mockResolvedValue(success(PDF));
  api.deleteCompany.mockResolvedValue(success(undefined));
});

describe("facture AbaNinja à la livraison d'une commande fictive", () => {
  it("prend le verrou, crée le client d'essai puis la facture, la note et rapporte son PDF", async () => {
    const result = await run();
    expect(result).toEqual(success({ uuid: INVOICE, number: "R02291", reference: plan.reference, pdf: PDF }));
    expect(lock.claimInvoiceSlot).toHaveBeenCalledWith({ shop: "test.myshopify.com", orderId: ORDER_ID, orderName: "#1042", reference: plan.reference, isTest: true });
    expect(api.createAddress.mock.calls[0]?.[2]).toMatchObject({ force: true });
    const input = api.createInvoice.mock.calls[0]?.[1];
    expect(input).toMatchObject({ receiver: { addressUuid: ADDRESS, companyUuid: COMPANY }, bankAccountUuid: BANK, reference: plan.reference });
    expect(lock.markCreated).toHaveBeenCalledWith(ORDER_ID, { invoiceUuid: INVOICE, systemInvoiceNumber: "R02291" });
    expect(api.downloadDraftInvoicePdf).toHaveBeenCalledWith(expect.anything(), INVOICE, input, {});
  });

  it("facture refusée : libère le verrou et retire le client d'essai", async () => {
    api.createInvoice.mockResolvedValue(failure(new CreateInvoiceError(new AbaNinjaError("donnees_refusees", { status: 422 }), "refusee")));
    const result = await run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.outcome).toBe("refusee");
    expect(lock.markRefused).toHaveBeenCalled();
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(result.error.details.join(" ")).toContain("retiré");
  });

  it("résultat incertain : ne retire rien et ne réessaie pas", async () => {
    api.createInvoice.mockResolvedValue(failure(new CreateInvoiceError(new AbaNinjaError("indisponible"), "incertaine")));
    const result = await run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.outcome).toBe("incertaine");
    expect(lock.markUncertain).toHaveBeenCalled();
    expect(api.deleteCompany).not.toHaveBeenCalled();
    expect(api.createInvoice).toHaveBeenCalledTimes(1);
  });

  it("verrou déjà pris par une facture faite : n'appelle pas AbaNinja et dit comment recommencer", async () => {
    lock.claimInvoiceSlot.mockResolvedValue(success({ invoice: row("creee"), claimed: false }));
    const result = await run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("R02290");
    expect(result.error.details.join(" ")).toContain("Effacer les factures d’essai");
    expect(api.createAddress).not.toHaveBeenCalled();
    expect(api.createInvoice).not.toHaveBeenCalled();
  });

  it("tentative précédente refusée : libère la ligne et recommence", async () => {
    lock.claimInvoiceSlot
      .mockResolvedValueOnce(success({ invoice: row("refusee"), claimed: false }))
      .mockResolvedValueOnce(success({ invoice: row("en_cours"), claimed: true }));
    const result = await run();
    expect(result.ok).toBe(true);
    expect(lock.releaseRefused).toHaveBeenCalledWith(ORDER_ID);
    expect(api.createInvoice).toHaveBeenCalledTimes(1);
  });

  it("PDF non récupéré : la facture reste notée et le message donne son numéro", async () => {
    api.downloadDraftInvoicePdf.mockResolvedValue(failure(new AbaNinjaError("indisponible")));
    const result = await run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(lock.markCreated).toHaveBeenCalled();
    expect(result.error.message).toContain("R02291");
  });

  it("client d'essai incertain : s'arrête sans créer de facture", async () => {
    api.createAddress.mockResolvedValue(failure(new AbaNinjaError("indisponible")));
    const result = await run();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.outcome).toBe("incertaine");
    expect(api.createInvoice).not.toHaveBeenCalled();
    expect(lock.markUncertain).toHaveBeenCalledWith(ORDER_ID, "client_incertain");
  });
});
