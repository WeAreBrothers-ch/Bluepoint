import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/vendeur";
import { failure, success } from "../core/result";
import type { ShopSettingsValues } from "../reglages/schema";
import { AbaNinjaError } from "./errors";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";
import { ADMIN, contact, NOTE, NOW, ORDER, RECEIVER, SALE, SHOP } from "./vente-bon.test-support";

const deps = vi.hoisted(() => ({
  fetchOrderForInvoice: vi.fn(),
  loadCompleteSettings: vi.fn(),
  readAbaNinjaConfig: vi.fn(),
  findSale: vi.fn(),
  claimSale: vi.fn(),
  releaseRefusedSale: vi.fn(),
  markNote: vi.fn(),
  createAddress: vi.fn(),
  createDeliveryNote: vi.fn(),
  getDeliveryNote: vi.fn(),
  deleteCompany: vi.fn(),
  findInvoiceByOrder: vi.fn(),
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: deps.logInfo, logError: deps.logError }));
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
vi.mock("./delivery-notes.server", () => ({ createDeliveryNote: deps.createDeliveryNote, getDeliveryNote: deps.getDeliveryNote }));
vi.mock("./invoice-cleanup.server", () => ({ deleteCompany: deps.deleteCompany }));

const { createSaleNoteForOrder } = await import("./vente-bon.server");
const realConfig = await vi.importActual<typeof import("./config.server")>("./config.server");
const CONFIG = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
const CONFIG_VALUE = CONFIG.ok ? CONFIG.value : expect.unreachable("configuration d’essai invalide");

function orderFound(orderTags: string[], customerTags: string[], order = COMMANDE_SHOPIFY) {
  deps.fetchOrderForInvoice.mockResolvedValue(success({ order, contact: contact(orderTags, customerTags) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  orderFound(["fictif"], []);
  deps.loadCompleteSettings.mockResolvedValue({ paymentTermDays: 30 } as ShopSettingsValues);
  deps.readAbaNinjaConfig.mockReturnValue(CONFIG);
  deps.findSale.mockResolvedValue(success(null));
  deps.claimSale.mockResolvedValue(success({ sale: SALE, claimed: true }));
  deps.releaseRefusedSale.mockResolvedValue(success(undefined));
  deps.markNote.mockResolvedValue(success(true));
  deps.createAddress.mockResolvedValue(success(RECEIVER));
  deps.createDeliveryNote.mockResolvedValue(success({ kind: "cree", uuid: NOTE }));
  deps.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "draft", reference: SALE.reference, number: "L00042", companyUuid: RECEIVER.companyUuid }));
  deps.deleteCompany.mockResolvedValue(success(undefined));
  deps.findInvoiceByOrder.mockResolvedValue(null);
});

describe("bon de livraison AbaNinja à l'arrivée d'une commande", () => {
  it("laisse une vraie commande de côté, sans rien demander à AbaNinja", async () => {
    orderFound([], ["pro"]);
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "pas_concernee" });
    expect(deps.claimSale).not.toHaveBeenCalled();
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("fait le bon d'un client d'essai qui commande par le site (étiquette sur le client seulement)", async () => {
    orderFound([], ["fictif"]);
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "cree", noteNumber: "L00042" });
    expect(deps.claimSale).toHaveBeenCalledWith({ shop: SHOP, orderId: ORDER, orderName: "#1042", reference: SALE.reference, isTest: true });
    expect(deps.createAddress).toHaveBeenCalledWith(CONFIG_VALUE, expect.objectContaining({ kind: "company" }), { force: true });
    expect(deps.createDeliveryNote).toHaveBeenCalledWith(
      CONFIG_VALUE,
      expect.objectContaining({ receiver: RECEIVER, reference: SALE.reference, deliveryNoteDate: "2026-11-19", deliveryDate: "2026-11-25" }),
    );
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "cree", noteUuid: NOTE, noteNumber: "L00042", ...RECEIVER });
  });

  it("journalise l'identifiant du bon dès qu'AbaNinja le donne", async () => {
    await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(deps.logInfo).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ orderId: ORDER, noteUuid: NOTE }));
  });

  it("ligne changée pendant le bon (effacée entre-temps) : l'état non noté est journalisé", async () => {
    deps.markNote.mockResolvedValue(success(false));
    await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(deps.logError).toHaveBeenCalledWith(expect.any(String), expect.any(Error), expect.objectContaining({ orderId: ORDER, state: "cree" }));
  });

  it("ne refait pas le bon quand Shopify renvoie la commande (ligne déjà prise)", async () => {
    deps.claimSale.mockResolvedValue(success({ sale: { ...SALE, noteState: "cree" }, claimed: false }));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "deja_fait" });
    expect(deps.createAddress).not.toHaveBeenCalled();
    expect(deps.createDeliveryNote).not.toHaveBeenCalled();
  });

  it("ne relit même pas la commande quand son bon existe déjà", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "incertain" }));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "deja_fait" });
    expect(deps.fetchOrderForInvoice).not.toHaveBeenCalled();
  });

  it("recommence après un bon refusé : la ligne refusée est libérée puis reprise", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "refuse" }));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toMatchObject({ kind: "cree" });
    expect(deps.releaseRefusedSale).toHaveBeenCalledWith(ORDER);
    expect(deps.claimSale).toHaveBeenCalledTimes(1);
  });

  it("bon refusé qui a laissé son client d'essai : ce client est supprimé d'abord, puis le bon est refait", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "refuse", ...RECEIVER }));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toMatchObject({ kind: "cree" });
    expect(deps.deleteCompany).toHaveBeenCalledWith(CONFIG_VALUE, RECEIVER.companyUuid);
    const [removedAt] = deps.deleteCompany.mock.invocationCallOrder;
    const [releasedAt] = deps.releaseRefusedSale.mock.invocationCallOrder;
    expect(removedAt).toBeLessThan(releasedAt ?? 0);
    expect(deps.claimSale).toHaveBeenCalledTimes(1);
  });

  it("client d'essai resté mais déjà supprimé dans AbaNinja : le bon est refait", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "refuse", ...RECEIVER }));
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("introuvable", { status: 404 })));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toMatchObject({ kind: "cree" });
    expect(deps.releaseRefusedSale).toHaveBeenCalledWith(ORDER);
  });

  it("client d'essai resté et impossible à supprimer : pas de nouvel essai, le client reste suivi", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "refuse", ...RECEIVER }));
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    const outcome = await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(outcome).toEqual({
      kind: "refuse",
      message:
        "Le bon précédent a été refusé et son client d’essai est resté dans AbaNinja : l’app n’a pas pu le supprimer. AbaNinja est momentanément injoignable, réessayez dans quelques instants. Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai » (il efface aussi les bons), puis « Créer le bon de livraison » sur la commande.",
    });
    expect(deps.releaseRefusedSale).not.toHaveBeenCalled();
    expect(deps.createAddress).not.toHaveBeenCalled();
  });

  it("bon refusé par AbaNinja : le client d'essai est retiré et la ligne marquée refusée", async () => {
    deps.createDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    const outcome = await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(outcome).toMatchObject({ kind: "refuse" });
    expect(deps.deleteCompany).toHaveBeenCalledWith(CONFIG_VALUE, RECEIVER.companyUuid);
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "refuse", errorCode: "donnees_refusees" });
  });

  it("bon refusé et client d'essai resté dans AbaNinja : ses identifiants sont notés pour l'effacer plus tard", async () => {
    deps.createDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    deps.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toMatchObject({ kind: "refuse" });
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "refuse", errorCode: "donnees_refusees", ...RECEIVER });
  });

  it("réponse incertaine : la ligne est marquée à vérifier, le bon n'est jamais redemandé", async () => {
    deps.createDeliveryNote.mockResolvedValue(success({ kind: "incertain" }));
    const outcome = await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(outcome).toMatchObject({ kind: "incertain" });
    expect(deps.createDeliveryNote).toHaveBeenCalledTimes(1);
    expect(deps.deleteCompany).not.toHaveBeenCalled();
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "incertain", errorCode: "bon_en_attente", ...RECEIVER });
  });

  it("AbaNinja injoignable pendant le bon : à vérifier, jamais effacé (un bon a peut-être été fait)", async () => {
    deps.createDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    expect(await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW)).toMatchObject({ kind: "incertain" });
    expect(deps.deleteCompany).not.toHaveBeenCalled();
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "incertain", errorCode: "indisponible", ...RECEIVER });
  });

  it("commande avec un rabais : pas de bon, message clair, rien créé dans AbaNinja", async () => {
    orderFound(["fictif"], [], {
      ...COMMANDE_SHOPIFY,
      currentSubtotalPriceSet: { shopMoney: { amount: "1382.4", currencyCode: "CHF" } },
      currentTotalPriceSet: { shopMoney: { amount: "1397.4", currencyCode: "CHF" } },
      currentTaxLines: [{ title: "TVA", ratePercentage: 8.1, priceSet: { shopMoney: { amount: "104.71", currencyCode: "CHF" } } }],
      discountCodes: ["PRO10"],
    });
    const outcome = await createSaleNoteForOrder(ADMIN, SHOP, ORDER, NOW);
    expect(outcome).toMatchObject({ kind: "refuse" });
    expect(outcome.kind === "refuse" ? outcome.message : "").toContain("rabais");
    expect(deps.claimSale).not.toHaveBeenCalled();
    expect(deps.createAddress).not.toHaveBeenCalled();
  });
});
