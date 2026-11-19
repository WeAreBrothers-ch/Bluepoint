import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { failure, success } from "../core/result";
import type { IsoDate } from "../metafields/definitions";
import type { ShopSettingsValues } from "../reglages/schema";
import { parseGid } from "../shopify/ids";
import type { InvoicePayment, PaymentTransaction } from "./order-payment";

const deps = vi.hoisted(() => ({ findSale: vi.fn(), ensureAbaNinjaSaleInvoice: vi.fn(), ensureAbaNinjaTestInvoice: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../abaninja/vente-repository.server", () => ({ findSale: deps.findSale }));
vi.mock("./abaninja-vente.server", () => ({ ensureAbaNinjaSaleInvoice: deps.ensureAbaNinjaSaleInvoice }));
vi.mock("./abaninja-facture.server", () => ({ ensureAbaNinjaTestInvoice: deps.ensureAbaNinjaTestInvoice }));

const { ensureViaAbaNinja } = await import("./abaninja-route.server");

const SHOP = "boutique.myshopify.com";
const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
const SALE = { shop: SHOP, orderId: ORDER, noteState: "cree", invoiceState: null };
const CARD: PaymentTransaction = { kind: "SALE", status: "SUCCESS", processedAt: "2026-11-10T08:15:00Z", gateway: "shopify_payments" };
const TO_PAY: InvoicePayment = { kind: "a_payer" };
const PAID: InvoicePayment = { kind: "payee", paidOn: "2026-11-10" as IsoDate };

function context(tags: readonly string[], transactions: readonly PaymentTransaction[] = []) {
  const contact = { tags, email: null, phone: null, customer: null, shippingAddress: null, billingAddress: null, fulfillments: [], displayFinancialStatus: null, transactions };
  return {
    shop: SHOP,
    orderId: ORDER,
    source: { order: COMMANDE_SHOPIFY, contact },
    settings: { paymentTermDays: 30 } as ShopSettingsValues,
    deliveryDate: "2026-11-18" as IsoDate,
    issueDate: "2026-11-19" as IsoDate,
    now: new Date("2026-11-19T10:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.findSale.mockResolvedValue(success(SALE));
  deps.ensureAbaNinjaSaleInvoice.mockResolvedValue(success({ fromNote: true }));
  deps.ensureAbaNinjaTestInvoice.mockResolvedValue(success({ inAbaNinja: true }));
});

describe("aiguillage d'une commande d'essai vers AbaNinja", () => {
  it("payée : la facture naît du bon, avec la date et le moyen du paiement", async () => {
    await ensureViaAbaNinja(context(["fictif"], [CARD]), PAID);
    expect(deps.ensureAbaNinjaSaleInvoice).toHaveBeenCalledWith(SALE, expect.anything(), { paidOn: "2026-11-10", gateway: "shopify_payments" });
  });

  it("bon refusé (rien dans AbaNinja) : facture directe, comme avant", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "refuse" }));
    await ensureViaAbaNinja(context(["fictif"]), TO_PAY);
    expect(deps.ensureAbaNinjaSaleInvoice).not.toHaveBeenCalled();
    expect(deps.ensureAbaNinjaTestInvoice).toHaveBeenCalled();
  });

  it("bon à vérifier : reste sur le bon, jamais une deuxième facture à côté", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "incertain" }));
    await ensureViaAbaNinja(context(["fictif"]), TO_PAY);
    expect(deps.ensureAbaNinjaSaleInvoice).toHaveBeenCalled();
    expect(deps.ensureAbaNinjaTestInvoice).not.toHaveBeenCalled();
  });

  it("pas de bon et commande payée : la facture acquittée habituelle (null)", async () => {
    deps.findSale.mockResolvedValue(success(null));
    expect(await ensureViaAbaNinja(context(["fictif"], [CARD]), PAID)).toBeNull();
  });

  it("vraie commande : jamais AbaNinja, la base n'est même pas lue", async () => {
    expect(await ensureViaAbaNinja(context(["pro"]), TO_PAY)).toBeNull();
    expect(deps.findSale).not.toHaveBeenCalled();
  });

  it("ligne d'une autre boutique : ignorée", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, shop: "autre.myshopify.com" }));
    await ensureViaAbaNinja(context(["fictif"]), TO_PAY);
    expect(deps.ensureAbaNinjaSaleInvoice).not.toHaveBeenCalled();
    expect(deps.ensureAbaNinjaTestInvoice).toHaveBeenCalled();
  });

  it("base illisible : erreur interne, rien n'est fait", async () => {
    deps.findSale.mockResolvedValue(failure(new Error("base en panne")));
    expect(await ensureViaAbaNinja(context(["fictif"]), TO_PAY)).toMatchObject({ ok: false, error: { code: "erreur_interne" } });
    expect(deps.ensureAbaNinjaTestInvoice).not.toHaveBeenCalled();
  });
});
