import type { AbaNinjaSale } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";

const api = vi.hoisted(() => ({
  listTestSales: vi.fn(),
  getInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  getDeliveryNote: vi.fn(),
  deleteDeliveryNote: vi.fn(),
  deleteCompany: vi.fn(),
}));
const tx = vi.hoisted(() => ({
  invoice: { findFirst: vi.fn(), delete: vi.fn() },
  storedFile: { deleteMany: vi.fn() },
  abaNinjaSale: { deleteMany: vi.fn() },
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("./vente-repository.server", () => ({ listTestSales: api.listTestSales }));
vi.mock("./invoices.server", () => ({ getInvoice: api.getInvoice }));
vi.mock("./invoice-cleanup.server", () => ({ deleteInvoice: api.deleteInvoice, deleteCompany: api.deleteCompany }));
vi.mock("./delivery-notes.server", () => ({ getDeliveryNote: api.getDeliveryNote, deleteDeliveryNote: api.deleteDeliveryNote }));

const { eraseTestSaleNotes } = await import("./vente-bon-effacer.server");

const NOW = new Date("2026-11-19T15:00:00Z");
const NOTE = "66666666-6666-4666-8666-666666666666";
const INVOICE = "77777777-7777-4777-8777-777777777777";
const COMPANY = "33333333-3333-4333-8333-333333333333";
const REF = "BP-ESSAI-CMD-1035-20261119-110530";

function sale(changes: Partial<AbaNinjaSale> = {}): AbaNinjaSale {
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

const NO_INVOICE = { invoiceState: null, invoiceUuid: null, invoiceNumber: null };

function invoice(status: string, reference = REF) {
  return success({ uuid: INVOICE, status, sentStatus: null, openAmount: 1551, dueDate: "2026-12-19", systemInvoiceNumber: "R02292", reference, isCancelled: false, companyUuid: COMPANY });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listTestSales.mockResolvedValue(success([sale()]));
  api.getInvoice.mockResolvedValue(invoice("draft"));
  api.deleteInvoice.mockResolvedValue(success(undefined));
  api.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "converted", reference: REF, number: "L00042", companyUuid: COMPANY }));
  api.deleteDeliveryNote.mockResolvedValue(success(undefined));
  api.deleteCompany.mockResolvedValue(success(undefined));
  tx.invoice.findFirst.mockResolvedValue({ id: "copie-2", pdfKey: "test.myshopify.com/R02292.pdf" });
});

describe("effacer les essais faits par les commandes fictives (bon, facture, client)", () => {
  it("efface la facture brouillon, le bon, le client d'essai, puis la copie et la ligne de l'app", async () => {
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("effacee");
    expect(api.deleteInvoice).toHaveBeenCalledWith(expect.anything(), INVOICE);
    expect(api.deleteDeliveryNote).toHaveBeenCalledWith(expect.anything(), NOTE);
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(tx.invoice.findFirst).toHaveBeenCalledWith({ where: { shop: "test.myshopify.com", orderId: "gid://shopify/Order/1035", number: { in: ["R02292", REF] } } });
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: "copie-2" } });
    expect(tx.abaNinjaSale.deleteMany).toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("facture déjà envoyée : rien n'est effacé dans AbaNinja, Eliott l'annule à la main", async () => {
    api.getInvoice.mockResolvedValue(invoice("sent"));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome).toMatchObject({ kind: "a_la_main" });
    expect(outcome?.text).toContain("Annulez-la dans AbaNinja");
    expect(api.deleteInvoice).not.toHaveBeenCalled();
    expect(api.deleteDeliveryNote).not.toHaveBeenCalled();
    expect(api.deleteCompany).not.toHaveBeenCalled();
  });

  it("AbaNinja ne répond pas : tout est gardé pour réessayer", async () => {
    api.getInvoice.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("gardee");
    expect(api.deleteDeliveryNote).not.toHaveBeenCalled();
    expect(tx.abaNinjaSale.deleteMany).not.toHaveBeenCalled();
  });

  it("référence différente de celle de l'essai : l'app ne touche à rien", async () => {
    api.getInvoice.mockResolvedValue(invoice("draft", "BP-1035"));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("gardee");
    expect(api.deleteInvoice).not.toHaveBeenCalled();
    expect(api.deleteDeliveryNote).not.toHaveBeenCalled();
    expect(tx.abaNinjaSale.deleteMany).not.toHaveBeenCalled();
  });

  it("bon sans facture : efface le bon et le client d'essai", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "cree", invoiceState: null, invoiceUuid: null, invoiceNumber: null })]));
    api.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "draft", reference: REF, number: "L00042", companyUuid: COMPANY }));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("effacee");
    expect(api.getInvoice).not.toHaveBeenCalled();
    expect(api.deleteDeliveryNote).toHaveBeenCalled();
    expect(api.deleteCompany).toHaveBeenCalled();
  });

  it("bon refusé : rien n'avait été créé, l'app oublie la ligne", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "refuse", noteUuid: null, companyUuid: null, invoiceState: null, invoiceUuid: null })]));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome).toEqual({ kind: "effacee", text: "#1035 : rien n’avait été créé dans AbaNinja." });
    expect(api.deleteCompany).not.toHaveBeenCalled();
    expect(api.deleteDeliveryNote).not.toHaveBeenCalled();
    expect(tx.abaNinjaSale.deleteMany).toHaveBeenCalled();
  });

  it("bon refusé qui a laissé son client d'essai : le client est effacé", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "refuse", noteUuid: null, noteNumber: null, ...NO_INVOICE })]));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(outcome).toEqual({ kind: "effacee", text: "#1035 : client d’essai effacé." });
    expect(tx.abaNinjaSale.deleteMany).toHaveBeenCalled();
  });

  it("client d'essai encore utilisé dans AbaNinja (409) : à faire à la main", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "refuse", noteUuid: null, noteNumber: null, ...NO_INVOICE })]));
    api.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 409 })));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("a_la_main");
    expect(outcome?.text).not.toContain("rien n’avait été créé");
  });

  it("bon non confirmé : le client noté est effacé, Eliott cherche le bon à la main", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "incertain", noteUuid: null, noteNumber: null, ...NO_INVOICE })]));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
    expect(outcome?.kind).toBe("a_la_main");
    expect(outcome?.text).toContain(REF);
    expect(outcome?.text).toContain("client d’essai est effacé");
  });

  it("bon non confirmé dont le client sert encore (409) : bon puis client à supprimer à la main", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "incertain", noteUuid: null, noteNumber: null, ...NO_INVOICE })]));
    api.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 409 })));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("a_la_main");
    expect(outcome?.text).toContain("sert encore");
  });

  it("bon dont la suppression est refusée : l'app oublie, Eliott le supprime à la main", async () => {
    api.deleteDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", NOW);
    expect(outcome?.kind).toBe("a_la_main");
    expect(outcome?.text).toContain(REF);
  });
});
