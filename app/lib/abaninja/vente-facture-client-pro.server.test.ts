import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateInvoiceInput } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { CreateInvoiceError } from "./invoice-errors";
import { testConfig } from "./test-support";
import { planTestSaleInvoice } from "./vente-plan";

/** Facture sans bon d'une commande fictive d'un pro : elle va au client pro fictif, jamais effacé avec elle. */

const api = vi.hoisted(() => ({
  findQrBankAccount: vi.fn(),
  createAddress: vi.fn(),
  proTestClient: vi.fn(),
  createInvoice: vi.fn(),
  downloadDraftInvoicePdf: vi.fn(),
  deleteCompany: vi.fn(),
}));
const lock = vi.hoisted(() => ({ claimInvoiceSlot: vi.fn(), markCreated: vi.fn(), markRefused: vi.fn(), markUncertain: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./bank-accounts.server", () => ({ findQrBankAccount: api.findQrBankAccount }));
vi.mock("./addresses.server", () => ({ createAddress: api.createAddress }));
vi.mock("./vente-client-pro.server", () => ({ proTestClient: api.proTestClient }));
vi.mock("./invoices.server", () => ({ createInvoice: api.createInvoice }));
vi.mock("./pdf-download.server", () => ({ downloadDraftInvoicePdf: api.downloadDraftInvoicePdf }));
vi.mock("./invoice-cleanup.server", () => ({ deleteCompany: api.deleteCompany }));
vi.mock("./repository.server", () => lock);

const { createTestSaleInvoice } = await import("./vente-facture.server");

const ORDER_ID = "gid://shopify/Order/1042";
const NOW = new Date("2026-11-19T11:05:30Z");
const CLIENT = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
const PDF = new Uint8Array([37, 80, 68, 70, 45]);
const CONFIG = testConfig();

const plan = (() => {
  const result = planTestSaleInvoice(validateInvoiceInput(FACTURE_EXEMPLE), NOW, true);
  if (!result.ok) throw result.error;
  return result.value;
})();

const run = () => createTestSaleInvoice(CONFIG, { shop: "test.myshopify.com", orderId: ORDER_ID, orderName: "#1042", plan, now: NOW });

beforeEach(() => {
  vi.clearAllMocks();
  const row = { orderId: ORDER_ID, state: "en_cours", reference: plan.reference, systemInvoiceNumber: null };
  lock.claimInvoiceSlot.mockResolvedValue(success({ invoice: row, claimed: true }));
  for (const mark of [lock.markCreated, lock.markRefused, lock.markUncertain]) mark.mockResolvedValue(success(row));
  api.findQrBankAccount.mockResolvedValue(success({ uuid: "11111111-1111-4111-8111-111111111111", name: "QR" }));
  api.proTestClient.mockResolvedValue(success(CLIENT));
  api.createInvoice.mockResolvedValue(success({ uuid: "44444444-4444-4444-8444-444444444444", systemInvoiceNumber: "R02291" }));
  api.downloadDraftInvoicePdf.mockResolvedValue(success(PDF));
  api.deleteCompany.mockResolvedValue(success(undefined));
});

describe("facture d'essai d'un pro", () => {
  it("va au client pro fictif : aucun nouveau client n'est créé pour elle", async () => {
    expect(await run()).toMatchObject({ ok: true, value: { number: "R02291" } });
    expect(api.proTestClient).toHaveBeenCalledWith(CONFIG, "test.myshopify.com", plan.clientAddress, NOW, {});
    expect(api.createAddress).not.toHaveBeenCalled();
    expect(api.createInvoice.mock.calls[0]?.[1]).toMatchObject({ receiver: CLIENT });
  });

  it("client pro fictif pas prêt : pas de facture, le verrou est rendu pour réessayer", async () => {
    const busy = Object.assign(new Error("Le client pro fictif est en train d’être créé. Réessayez dans un instant."), { code: "client_pro_en_cours" });
    api.proTestClient.mockResolvedValue(failure(busy));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: { outcome: "refusee", message: "Le client pro fictif n’est pas prêt.", details: [busy.message] } });
    expect(lock.markRefused).toHaveBeenCalledWith(ORDER_ID, "client_pro_en_cours");
    expect(api.createInvoice).not.toHaveBeenCalled();
  });

  it("facture refusée par AbaNinja : le client pro fictif reste pour les autres essais", async () => {
    api.createInvoice.mockResolvedValue(failure(new CreateInvoiceError(new AbaNinjaError("donnees_refusees", { status: 422 }), "refusee")));
    const result = await run();
    expect(result).toMatchObject({ ok: false, error: { outcome: "refusee", message: "AbaNinja a refusé la facture." } });
    expect(result.ok ? [] : result.error.details).toEqual([expect.any(String), expect.stringContaining("Si le « Client pro fictif » a été supprimé dans AbaNinja")]);
    expect(api.deleteCompany).not.toHaveBeenCalled();
  });
});
