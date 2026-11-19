import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/vendeur";
import { AbaNinjaError } from "../abaninja/errors";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "../abaninja/test-support";
import { SaleInvoiceError } from "../abaninja/vente-errors";
import { failure, success } from "../core/result";
import type { IsoDate } from "../metafields/definitions";
import type { ShopSettingsValues } from "../reglages/schema";
import { parseGid } from "../shopify/ids";

const created = vi.hoisted(() => ({ files: [] as Record<string, unknown>[], invoices: [] as Record<string, unknown>[] }));
const deps = vi.hoisted(() => ({ readAbaNinjaConfig: vi.fn(), createTestSaleInvoice: vi.fn() }));

const tx = {
  storedFile: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => created.files.push(data)) },
  invoice: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => (created.invoices.push(data), { id: "copie-1", ...data })) },
};

vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../reglages/seller", () => ({ toInvoiceSeller: () => VENDEUR_EXEMPLE }));
vi.mock("../abaninja/config.server", () => ({ readAbaNinjaConfig: deps.readAbaNinjaConfig }));
vi.mock("../abaninja/vente-facture.server", () => ({ createTestSaleInvoice: deps.createTestSaleInvoice }));

const { ensureAbaNinjaTestInvoice } = await import("./abaninja-facture.server");
const { goesToAbaNinja } = await import("./abaninja-lines");
const realConfig = await vi.importActual<typeof import("../abaninja/config.server")>("../abaninja/config.server");
const CONFIG = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });

const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
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
const sale = {
  shop: "test.myshopify.com",
  orderId: ORDER,
  source: { order: COMMANDE_SHOPIFY, contact },
  settings: { paymentTermDays: 30 } as ShopSettingsValues,
  deliveryDate: "2026-11-19" as IsoDate,
  issueDate: "2026-11-19" as IsoDate,
  now: new Date("2026-11-19T11:05:30Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  created.files.length = 0;
  created.invoices.length = 0;
  deps.readAbaNinjaConfig.mockReturnValue(CONFIG);
  deps.createTestSaleInvoice.mockResolvedValue(success({ uuid: "u", number: "R02291", reference: "BP-ESSAI-FACT-1042-20261119-110530", pdf: PDF }));
});

describe("facture AbaNinja d'une commande d'essai, vue depuis l'app", () => {
  it("ne concerne que les commandes étiquetées « fictif »", () => {
    expect(goesToAbaNinja(sale.source)).toBe(true);
    expect(goesToAbaNinja({ ...sale.source, contact: { ...contact, tags: ["pro"] } })).toBe(false);
  });

  it("reconnaît aussi un client d'essai qui commande par le site (étiquette sur le client, pas sur la commande)", () => {
    const customer = { defaultEmailAddress: null, defaultPhoneNumber: null, tags: ["fictif"] };
    expect(goesToAbaNinja({ contact: { ...contact, tags: [], customer } })).toBe(true);
    expect(goesToAbaNinja({ contact: { ...contact, tags: [], customer: { ...customer, tags: ["pro"] } } })).toBe(false);
  });

  it("garde une copie avec le numéro et le PDF d'AbaNinja, au total de la commande, pour l'envoyer", async () => {
    const result = await ensureAbaNinjaTestInvoice(sale);
    expect(result).toMatchObject({ ok: true, value: { created: true, inAbaNinja: true } });
    expect(created.invoices).toEqual([
      expect.objectContaining({
        number: "R02291",
        orderName: "#1042",
        totalCents: 155_100,
        issueDate: "2026-11-19",
        dueDate: "2026-12-19",
        paidOn: null,
        customerName: "Restaurant Le Pressoir",
        customerEmail: "luca.fictif@example.com",
        customerPhone: "+41790000102",
      }),
    ]);
    expect(created.files).toEqual([expect.objectContaining({ key: created.invoices[0]?.["pdfKey"], contentType: "application/pdf" })]);
    const request = deps.createTestSaleInvoice.mock.calls[0]?.[1];
    expect(request).toMatchObject({ shop: "test.myshopify.com", orderId: ORDER, orderName: "#1042" });
    expect(request.plan.reference.startsWith("BP-ESSAI-FACT-1042-")).toBe(true);
  });

  it("prend la référence d'essai comme numéro quand AbaNinja n'en donne pas au brouillon", async () => {
    deps.createTestSaleInvoice.mockResolvedValue(success({ uuid: "u", number: null, reference: "BP-ESSAI-FACT-1042-20261119-110530", pdf: PDF }));
    await ensureAbaNinjaTestInvoice(sale);
    expect(created.invoices[0]).toMatchObject({ number: "BP-ESSAI-FACT-1042-20261119-110530" });
  });

  it("résultat incertain : le dit clairement et ne garde aucune copie", async () => {
    deps.createTestSaleInvoice.mockResolvedValue(failure(new SaleInvoiceError("incertaine", "AbaNinja n’a pas confirmé la facture.", ["Regardez dans AbaNinja."])));
    const result = await ensureAbaNinjaTestInvoice(sale);
    expect(result).toMatchObject({ ok: false, error: { code: "abaninja_incertain", details: ["AbaNinja n’a pas confirmé la facture.", "Regardez dans AbaNinja."] } });
    expect(created.invoices).toEqual([]);
  });

  it("AbaNinja pas configuré : aucune facture, un message clair", async () => {
    deps.readAbaNinjaConfig.mockReturnValue(failure(new AbaNinjaError("non_configure", { message: "Le jeton AbaNinja (ABANINJA_TOKEN) est absent." })));
    const result = await ensureAbaNinjaTestInvoice(sale);
    expect(result).toMatchObject({ ok: false, error: { code: "abaninja_echec" } });
    expect(deps.createTestSaleInvoice).not.toHaveBeenCalled();
  });
});
