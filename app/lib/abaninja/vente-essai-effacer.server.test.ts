import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import type { AbaNinjaInvoice } from "./repository-types";
import { testConfig } from "./test-support";

const api = vi.hoisted(() => ({ getInvoice: vi.fn(), deleteInvoice: vi.fn(), deleteCompany: vi.fn(), findTestSaleRows: vi.fn() }));
const tx = vi.hoisted(() => ({
  invoice: { findFirst: vi.fn(), delete: vi.fn() },
  storedFile: { deleteMany: vi.fn() },
  abaNinjaInvoice: { deleteMany: vi.fn() },
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("./invoices.server", () => ({ getInvoice: api.getInvoice }));
vi.mock("./invoice-cleanup.server", () => ({ deleteInvoice: api.deleteInvoice, deleteCompany: api.deleteCompany }));
vi.mock("./vente-essai-liste.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./vente-essai-liste.server")>()),
  findTestSaleRows: api.findTestSaleRows,
}));

const { eraseTestInvoices } = await import("./vente-essai-effacer.server");
const { summarize } = await import("./vente-essai-resume");

async function eraseTestSales(...args: Parameters<typeof eraseTestInvoices>) {
  return summarize(await eraseTestInvoices(...args));
}

const NOW = new Date("2026-11-19T12:00:00Z");
const INVOICE = "44444444-4444-4444-8444-444444444444";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const REFERENCE = "BP-ESSAI-FACT-1036-20261119-110530";

function row(changes: Partial<AbaNinjaInvoice> = {}): AbaNinjaInvoice {
  return {
    id: "ligne-1",
    shop: "test.myshopify.com",
    orderId: "gid://shopify/Order/1036",
    orderName: "#1036",
    state: "creee",
    isTest: true,
    reference: REFERENCE,
    invoiceUuid: INVOICE,
    systemInvoiceNumber: "R02291",
    status: null,
    openAmountCents: null,
    statusCheckedAt: null,
    lastErrorCode: null,
    attempts: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...changes,
  };
}

function details(status: string, reference = REFERENCE) {
  return success({ uuid: INVOICE, status, sentStatus: null, openAmount: 564, dueDate: "2026-12-19", systemInvoiceNumber: "R02291", reference, isCancelled: false, companyUuid: COMPANY });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.findTestSaleRows.mockResolvedValue([row()]);
  api.getInvoice.mockResolvedValue(details("draft"));
  api.deleteInvoice.mockResolvedValue(success(undefined));
  api.deleteCompany.mockResolvedValue(success(undefined));
  tx.invoice.findFirst.mockResolvedValue({ id: "copie-1", pdfKey: "factures/test/R02291.pdf" });
});

describe("effacer les factures d'essai de « J'ai livré »", () => {
  it("efface le brouillon, son client d'essai, puis la copie de l'app et la ligne", async () => {
    const outcome = await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(outcome).toMatchObject({ tone: "success", heading: "Factures d’essai effacées" });
    expect(api.deleteInvoice).toHaveBeenCalledWith(expect.anything(), INVOICE);
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(tx.invoice.findFirst).toHaveBeenCalledWith({
      where: { shop: "test.myshopify.com", orderId: "gid://shopify/Order/1036", number: { in: ["R02291", REFERENCE] } },
    });
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: "copie-1" } });
    expect(tx.storedFile.deleteMany).toHaveBeenCalledWith({ where: { key: "factures/test/R02291.pdf" } });
    expect(tx.abaNinjaInvoice.deleteMany).toHaveBeenCalledWith({ where: { id: "ligne-1" } });
  });

  it("n'efface jamais une facture qui n'est plus un brouillon", async () => {
    api.getInvoice.mockResolvedValue(details("sent"));
    const outcome = await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(api.deleteInvoice).not.toHaveBeenCalled();
    expect(api.deleteCompany).not.toHaveBeenCalled();
    expect(outcome.tone).toBe("warning");
    expect(outcome.details.join(" ")).toContain("Annulez-la dans AbaNinja");
  });

  it.each(["deleted", "archived"])("facture déjà supprimée à la main (%s) : retire le client d'essai et oublie l'essai", async (status) => {
    api.getInvoice.mockResolvedValue(details(status));
    const outcome = await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(api.deleteInvoice).not.toHaveBeenCalled();
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(outcome).toMatchObject({ tone: "success", heading: "Factures d’essai effacées" });
    expect(outcome.details.join(" ")).toContain("déjà supprimée");
    expect(tx.abaNinjaInvoice.deleteMany).toHaveBeenCalledWith({ where: { id: "ligne-1" } });
  });

  it("ne touche à rien si la facture d'AbaNinja ne porte pas la référence de l'essai", async () => {
    api.getInvoice.mockResolvedValue(details("draft", "R-VRAIE-FACTURE"));
    await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(api.deleteInvoice).not.toHaveBeenCalled();
    expect(tx.abaNinjaInvoice.deleteMany).not.toHaveBeenCalled();
  });

  it("garde l'essai quand AbaNinja ne répond pas, pour réessayer plus tard", async () => {
    api.getInvoice.mockResolvedValue(failure(new AbaNinjaError("indisponible")));
    const outcome = await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(outcome.heading).toBe("Une partie n’a pas pu être effacée");
    expect(tx.abaNinjaInvoice.deleteMany).not.toHaveBeenCalled();
  });

  it("oublie une tentative refusée sans appeler AbaNinja", async () => {
    api.findTestSaleRows.mockResolvedValue([row({ state: "refusee", invoiceUuid: null, systemInvoiceNumber: null })]);
    const outcome = await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(outcome.tone).toBe("success");
    expect(api.getInvoice).not.toHaveBeenCalled();
    expect(tx.abaNinjaInvoice.deleteMany).toHaveBeenCalled();
  });

  it("laisse tranquille une facture encore en train d'être faite", async () => {
    api.findTestSaleRows.mockResolvedValue([row({ state: "en_cours", invoiceUuid: null, systemInvoiceNumber: null, updatedAt: new Date(NOW.getTime() - 30_000) })]);
    await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(tx.abaNinjaInvoice.deleteMany).not.toHaveBeenCalled();
  });

  it("une tentative incertaine : l'app l'oublie et dit quoi chercher dans AbaNinja", async () => {
    api.findTestSaleRows.mockResolvedValue([row({ state: "incertaine", invoiceUuid: null, systemInvoiceNumber: null })]);
    const outcome = await eraseTestSales(testConfig(), "test.myshopify.com", NOW);
    expect(outcome.details.join(" ")).toContain(REFERENCE);
    expect(outcome.details.join(" ")).toContain("essai BluePoint 20261119-110530");
    expect(tx.abaNinjaInvoice.deleteMany).toHaveBeenCalled();
  });
});
