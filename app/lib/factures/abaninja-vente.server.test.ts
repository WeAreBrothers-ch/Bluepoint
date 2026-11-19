import type { AbaNinjaSale } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/vendeur";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "../abaninja/test-support";
import { SaleInvoiceError } from "../abaninja/vente-errors";
import { failure, success } from "../core/result";
import type { IsoDate } from "../metafields/definitions";
import type { ShopSettingsValues } from "../reglages/schema";
import { parseGid } from "../shopify/ids";

const created = vi.hoisted(() => ({ invoices: [] as Record<string, unknown>[] }));
const deps = vi.hoisted(() => ({ readAbaNinjaConfig: vi.fn(), convertSaleNote: vi.fn(), resumeSaleInvoice: vi.fn() }));

const tx = {
  storedFile: { create: vi.fn(async () => ({})) },
  invoice: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (created.invoices.push(data), { id: "copie-2", ...data })) },
};

vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../reglages/seller", () => ({ toInvoiceSeller: () => VENDEUR_EXEMPLE }));
vi.mock("../abaninja/config.server", () => ({ readAbaNinjaConfig: deps.readAbaNinjaConfig }));
vi.mock("../abaninja/vente-conversion.server", () => ({ convertSaleNote: deps.convertSaleNote, resumeSaleInvoice: deps.resumeSaleInvoice }));

const { ensureAbaNinjaSaleInvoice } = await import("./abaninja-vente.server");
const realConfig = await vi.importActual<typeof import("../abaninja/config.server")>("../abaninja/config.server");
const CONFIG = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });

const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
const REF = "BP-ESSAI-CMD-1042-20261119-110530";
const PDF = new Uint8Array([37, 80, 68, 70, 45]);
const contact = {
  tags: ["fictif"],
  email: "luca.fictif@example.com",
  phone: "+41790000102",
  customer: null,
  shippingAddress: null,
  billingAddress: null,
  fulfillments: [],
  displayFinancialStatus: "PENDING",
  transactions: [],
};
const CONTEXT = {
  shop: "test.myshopify.com",
  orderId: ORDER,
  source: { order: COMMANDE_SHOPIFY, contact },
  settings: { paymentTermDays: 30 } as ShopSettingsValues,
  deliveryDate: "2026-11-20" as IsoDate,
  issueDate: "2026-11-20" as IsoDate,
  now: new Date("2026-11-20T15:00:00Z"),
};
const SALE: AbaNinjaSale = {
  id: "v1",
  shop: "test.myshopify.com",
  orderId: ORDER,
  orderName: "#1042",
  isTest: true,
  reference: REF,
  noteState: "cree",
  noteUuid: "66666666-6666-4666-8666-666666666666",
  noteNumber: "L00042",
  addressUuid: "22222222-2222-4222-8222-222222222222",
  companyUuid: "33333333-3333-4333-8333-333333333333",
  invoiceState: null,
  invoiceUuid: null,
  invoiceNumber: null,
  paymentState: null,
  lastErrorCode: null,
  createdAt: new Date("2026-11-19T11:05:30Z"),
  updatedAt: new Date("2026-11-19T11:05:30Z"),
};
const DOCUMENT = { uuid: "77777777-7777-4777-8777-777777777777", number: "R02292", reference: REF, pdf: PDF };

beforeEach(() => {
  vi.clearAllMocks();
  created.invoices.length = 0;
  deps.readAbaNinjaConfig.mockReturnValue(CONFIG);
  deps.convertSaleNote.mockResolvedValue(success(DOCUMENT));
  deps.resumeSaleInvoice.mockResolvedValue(success(DOCUMENT));
});

describe("facture d'une commande d'essai née de son bon de livraison", () => {
  it("à payer : transforme le bon (date du bon gardée, livraison réelle) et garde une copie à envoyer", async () => {
    const result = await ensureAbaNinjaSaleInvoice(SALE, CONTEXT, null);
    expect(result).toMatchObject({ ok: true, value: { created: true, inAbaNinja: true, fromNote: true } });
    const [, request] = deps.convertSaleNote.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      sale: SALE,
      note: { reference: REF, deliveryNoteDate: "2026-11-19", deliveryDate: "2026-11-20" },
      invoice: { reference: REF, invoiceDate: "2026-11-20", dueDate: "2026-12-20", terms: "Payable à 30 jours" },
      payment: null,
    });
    expect(created.invoices).toEqual([expect.objectContaining({ number: "R02292", totalCents: 155_100, paidOn: null, orderName: "#1042" })]);
  });

  it("payée : la facture dit « Payée » et le paiement part avec elle", async () => {
    await ensureAbaNinjaSaleInvoice(SALE, CONTEXT, { paidOn: "2026-11-18" as IsoDate, gateway: "shopify_payments" });
    const [, request] = deps.convertSaleNote.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      invoice: { terms: "Payée", dueDate: "2026-11-20" },
      payment: { amountChf: 1551, paymentDate: "2026-11-18", paymentType: "DEBIT_CREDIT_CARD", info: "Payée dans Shopify (shopify_payments)" },
    });
    expect(created.invoices).toEqual([expect.objectContaining({ paidOn: "2026-11-18" })]);
  });

  it("reprend la facture déjà née du bon, sans retransformer le bon", async () => {
    await ensureAbaNinjaSaleInvoice({ ...SALE, noteState: "converti", invoiceState: "creee", invoiceUuid: DOCUMENT.uuid }, CONTEXT, null);
    expect(deps.resumeSaleInvoice).toHaveBeenCalled();
    expect(deps.convertSaleNote).not.toHaveBeenCalled();
  });

  it("attend quand la facture est déjà en train de se faire", async () => {
    const result = await ensureAbaNinjaSaleInvoice({ ...SALE, invoiceState: "en_cours" }, CONTEXT, null);
    expect(result).toMatchObject({ ok: false, error: { code: "abaninja_incertain" } });
    expect(deps.convertSaleNote).not.toHaveBeenCalled();
  });

  it("refuse la facture d'un bon annulé ou à vérifier", async () => {
    expect(await ensureAbaNinjaSaleInvoice({ ...SALE, noteState: "annule" }, CONTEXT, null)).toMatchObject({ ok: false, error: { code: "abaninja_echec" } });
    expect(await ensureAbaNinjaSaleInvoice({ ...SALE, noteState: "incertain" }, CONTEXT, null)).toMatchObject({ ok: false, error: { code: "abaninja_incertain" } });
    expect(deps.convertSaleNote).not.toHaveBeenCalled();
  });

  it("rapporte l'échec d'AbaNinja avec ses précisions, sans copie dans l'app", async () => {
    deps.convertSaleNote.mockResolvedValue(failure(new SaleInvoiceError("incertaine", "AbaNinja n’a pas confirmé la facture du bon de livraison.", ["Regardez."])));
    const result = await ensureAbaNinjaSaleInvoice(SALE, CONTEXT, null);
    expect(result).toMatchObject({ ok: false, error: { code: "abaninja_incertain", details: ["AbaNinja n’a pas confirmé la facture du bon de livraison.", "Regardez."] } });
    expect(created.invoices).toEqual([]);
  });
});
