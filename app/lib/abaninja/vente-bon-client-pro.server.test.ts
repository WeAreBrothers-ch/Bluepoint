import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/vendeur";
import { failure, success } from "../core/result";
import type { ShopSettingsValues } from "../reglages/schema";
import { AbaNinjaError } from "./errors";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";
import { ADMIN, contact, NOTE, NOW, ORDER, RECEIVER, SALE, SHOP } from "./vente-bon.test-support";

/** Commande fictive d'un pro : son bon va au client pro fictif, toujours le même, jamais effacé avec ce seul bon. */

const deps = vi.hoisted(() => ({
  fetchOrderForInvoice: vi.fn(),
  loadCompleteSettings: vi.fn(),
  readAbaNinjaConfig: vi.fn(),
  findSale: vi.fn(),
  claimSale: vi.fn(),
  markNote: vi.fn(),
  createAddress: vi.fn(),
  proTestClient: vi.fn(),
  createDeliveryNote: vi.fn(),
  getDeliveryNote: vi.fn(),
  deleteCompany: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../reglages/seller", () => ({ toInvoiceSeller: () => VENDEUR_EXEMPLE }));
vi.mock("../reglages/settings.server", () => ({ loadCompleteSettings: deps.loadCompleteSettings }));
vi.mock("../factures/shopify-order.server", () => ({ fetchOrderForInvoice: deps.fetchOrderForInvoice }));
vi.mock("../factures/repository.server", () => ({ findInvoiceByOrder: vi.fn(async () => null) }));
vi.mock("./config.server", () => ({ readAbaNinjaConfig: deps.readAbaNinjaConfig }));
vi.mock("./vente-repository.server", () => ({ findSale: deps.findSale, claimSale: deps.claimSale, releaseRefusedSale: vi.fn(), markNote: deps.markNote }));
vi.mock("./addresses.server", () => ({ createAddress: deps.createAddress }));
vi.mock("./vente-client-pro.server", () => ({ proTestClient: deps.proTestClient }));
vi.mock("./delivery-notes.server", () => ({ createDeliveryNote: deps.createDeliveryNote, getDeliveryNote: deps.getDeliveryNote }));
vi.mock("./invoice-cleanup.server", () => ({ deleteCompany: deps.deleteCompany }));

const { createSaleNoteForOrder } = await import("./vente-bon.server");
const realConfig = await vi.importActual<typeof import("./config.server")>("./config.server");
const CONFIG = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
const CONFIG_VALUE = CONFIG.ok ? CONFIG.value : expect.unreachable("configuration d’essai invalide");
const PRO_NAME = "Client pro fictif · essai BluePoint";

beforeEach(() => {
  vi.clearAllMocks();
  deps.fetchOrderForInvoice.mockResolvedValue(success({ order: COMMANDE_SHOPIFY, contact: contact([], ["fictif", "pro"]) }));
  deps.loadCompleteSettings.mockResolvedValue({ paymentTermDays: 30 } as ShopSettingsValues);
  deps.readAbaNinjaConfig.mockReturnValue(CONFIG);
  deps.findSale.mockResolvedValue(success(null));
  deps.claimSale.mockResolvedValue(success({ sale: SALE, claimed: true }));
  deps.markNote.mockResolvedValue(success(true));
  deps.proTestClient.mockResolvedValue(success(RECEIVER));
  deps.createDeliveryNote.mockResolvedValue(success({ kind: "cree", uuid: NOTE }));
  deps.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "draft", reference: SALE.reference, number: "L00042", companyUuid: RECEIVER.companyUuid }));
  deps.deleteCompany.mockResolvedValue(success(undefined));
});

describe("bon d'une commande fictive d'un pro", () => {
  it("va au client pro fictif : aucun nouveau client n'est créé pour ce bon", async () => {
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "cree", noteNumber: "L00042" });
    expect(deps.proTestClient).toHaveBeenCalledWith(CONFIG_VALUE, SHOP, expect.objectContaining({ kind: "company", name: PRO_NAME }), NOW);
    expect(deps.createAddress).not.toHaveBeenCalled();
    expect(deps.createDeliveryNote).toHaveBeenCalledWith(CONFIG_VALUE, expect.objectContaining({ receiver: RECEIVER }));
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, expect.objectContaining({ state: "cree", ...RECEIVER }));
  });

  it("client pro fictif pas disponible : pas de bon, le refus est expliqué, rien à effacer", async () => {
    const busy = { code: "client_pro_en_cours", message: "Le client pro fictif est en train d’être créé. Réessayez dans un instant.", name: "ProClientError" };
    deps.proTestClient.mockResolvedValue(failure(Object.assign(new Error(busy.message), busy)));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "refuse", message: busy.message });
    expect(deps.createDeliveryNote).not.toHaveBeenCalled();
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "refuse", errorCode: "client_pro_en_cours" });
  });

  it("bon refusé par AbaNinja : le client pro fictif reste, il sert aux autres essais", async () => {
    deps.createDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    const outcome = await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(outcome).toMatchObject({ kind: "refuse", message: expect.stringContaining("AbaNinja a refusé le bon de livraison") });
    expect(outcome).toMatchObject({ message: expect.stringContaining("Si le « Client pro fictif » a été supprimé dans AbaNinja") });
    expect(deps.deleteCompany).not.toHaveBeenCalled();
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "refuse", errorCode: "donnees_refusees" });
  });
});
