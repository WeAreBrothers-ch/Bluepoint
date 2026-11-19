import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/vendeur";
import { success } from "../core/result";
import type { ShopSettingsValues } from "../reglages/schema";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";
import { ADMIN, contact, NOW, ORDER, RECEIVER, SALE, SHOP, type FulfillmentFixture } from "./vente-bon.test-support";

/** Une commande d'essai facturée ou livrée avant les bons de livraison n'a pas de bon : le serveur refuse, pas seulement le bouton. */

const deps = vi.hoisted(() => ({
  fetchOrderForInvoice: vi.fn(),
  findInvoiceByOrder: vi.fn(),
  loadCompleteSettings: vi.fn(),
  readAbaNinjaConfig: vi.fn(),
  findSale: vi.fn(),
  claimSale: vi.fn(),
  releaseRefusedSale: vi.fn(),
  markNote: vi.fn(),
  createAddress: vi.fn(),
  createDeliveryNote: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../reglages/seller", () => ({ toInvoiceSeller: () => VENDEUR_EXEMPLE }));
vi.mock("../reglages/settings.server", () => ({ loadCompleteSettings: deps.loadCompleteSettings }));
vi.mock("../factures/shopify-order.server", () => ({ fetchOrderForInvoice: deps.fetchOrderForInvoice }));
vi.mock("../factures/repository.server", () => ({ findInvoiceByOrder: deps.findInvoiceByOrder }));
vi.mock("./config.server", () => ({ readAbaNinjaConfig: deps.readAbaNinjaConfig }));
vi.mock("./vente-repository.server", () => ({
  findSale: deps.findSale,
  claimSale: deps.claimSale,
  releaseRefusedSale: deps.releaseRefusedSale,
  markNote: deps.markNote,
}));
vi.mock("./addresses.server", () => ({ createAddress: deps.createAddress }));
vi.mock("./delivery-notes.server", () => ({ createDeliveryNote: deps.createDeliveryNote, getDeliveryNote: vi.fn() }));
vi.mock("./invoice-cleanup.server", () => ({ deleteCompany: vi.fn() }));

const { createSaleNoteForOrder } = await import("./vente-bon.server");
const realConfig = await vi.importActual<typeof import("./config.server")>("./config.server");

const TOO_LATE = "Facture faite avant les bons de livraison : pas de bon pour cette commande.";
const DELIVERED: FulfillmentFixture = { status: "SUCCESS", createdAt: "2026-11-18T09:00:00Z", deliveredAt: null };

function orderFound(fulfillments: readonly FulfillmentFixture[] = []) {
  deps.fetchOrderForInvoice.mockResolvedValue(success({ order: COMMANDE_SHOPIFY, contact: contact(["fictif"], [], fulfillments) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  orderFound();
  deps.findInvoiceByOrder.mockResolvedValue(null);
  deps.loadCompleteSettings.mockResolvedValue({ paymentTermDays: 30 } as ShopSettingsValues);
  deps.readAbaNinjaConfig.mockReturnValue(realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }));
  deps.findSale.mockResolvedValue(success(null));
  deps.claimSale.mockResolvedValue(success({ sale: SALE, claimed: true }));
  deps.markNote.mockResolvedValue(success(SALE));
  deps.createAddress.mockResolvedValue(success(RECEIVER));
  deps.createDeliveryNote.mockResolvedValue(success({ kind: "incertain" }));
});

describe("pas de bon pour une commande déjà facturée ou livrée", () => {
  it("copie de facture déjà dans l'app : refusé, rien demandé à AbaNinja", async () => {
    deps.findInvoiceByOrder.mockResolvedValue({ id: "copie-1", orderId: ORDER, number: "R02291" });
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "refuse", message: TOO_LATE });
    expect(deps.claimSale).not.toHaveBeenCalled();
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("commande déjà livrée : refusé, rien demandé à AbaNinja", async () => {
    orderFound([DELIVERED]);
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "refuse", message: TOO_LATE });
    expect(deps.claimSale).not.toHaveBeenCalled();
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("livraison annulée seulement : le bon se fait quand même", async () => {
    orderFound([{ ...DELIVERED, status: "CANCELLED" }]);
    await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(deps.claimSale).toHaveBeenCalledTimes(1);
  });
});
