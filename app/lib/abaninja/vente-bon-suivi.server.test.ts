import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateInvoiceInput } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import { failure, success } from "../core/result";
import { parseGid } from "../shopify/ids";
import { AbaNinjaError } from "./errors";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";

const deps = vi.hoisted(() => ({
  findSale: vi.fn(),
  markNote: vi.fn(),
  loadSaleSource: vi.fn(),
  readAbaNinjaConfig: vi.fn(),
  updateDeliveryNote: vi.fn(),
  cancelDeliveryNote: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./config.server", () => ({ readAbaNinjaConfig: deps.readAbaNinjaConfig }));
vi.mock("./vente-repository.server", () => ({ findSale: deps.findSale, markNote: deps.markNote }));
vi.mock("./vente-bon-source.server", () => ({ loadSaleSource: deps.loadSaleSource }));
vi.mock("./delivery-notes.server", () => ({ updateDeliveryNote: deps.updateDeliveryNote, cancelDeliveryNote: deps.cancelDeliveryNote }));

const { cancelSaleNote, syncSaleNote } = await import("./vente-bon-suivi.server");
const realConfig = await vi.importActual<typeof import("./config.server")>("./config.server");
const CONFIG = realConfig.readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
const CONFIG_VALUE = CONFIG.ok ? CONFIG.value : expect.unreachable("configuration d’essai invalide");

const ADMIN = {} as AdminApiContext;
const SHOP = "test.myshopify.com";
const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
const NOW = new Date("2026-11-21T09:00:00Z");
const NOTE = "66666666-6666-4666-8666-666666666666";
const RECEIVER = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
const SALE = {
  shop: SHOP,
  orderId: ORDER,
  orderName: "#1042",
  reference: "BP-ESSAI-CMD-1042-20261119-110530",
  noteState: "cree",
  noteUuid: NOTE,
  noteNumber: "L00042",
  ...RECEIVER,
  createdAt: new Date("2026-11-19T11:05:30Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  deps.readAbaNinjaConfig.mockReturnValue(CONFIG);
  deps.findSale.mockResolvedValue(success(SALE));
  deps.markNote.mockResolvedValue(success(SALE));
  deps.loadSaleSource.mockResolvedValue(success({ input: validateInvoiceInput(FACTURE_EXEMPLE), plannedDate: "2026-11-25", isTest: true }));
  deps.updateDeliveryNote.mockResolvedValue(success(undefined));
  deps.cancelDeliveryNote.mockResolvedValue(success(undefined));
});

describe("le bon de livraison suit « Modifier les vins »", () => {
  it("ne fait rien pour une commande sans bon", async () => {
    deps.findSale.mockResolvedValue(success(null));
    expect(await syncSaleNote(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "rien" });
    expect(deps.loadSaleSource).not.toHaveBeenCalled();
    expect(deps.updateDeliveryNote).not.toHaveBeenCalled();
  });

  it("remet le bon aux vins actuels, en gardant sa référence, sa date et son client", async () => {
    expect(await syncSaleNote(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "fait" });
    expect(deps.updateDeliveryNote).toHaveBeenCalledWith(
      CONFIG_VALUE,
      NOTE,
      expect.objectContaining({
        receiver: RECEIVER,
        reference: SALE.reference,
        deliveryNoteDate: "2026-11-19",
        deliveryDate: "2026-11-25",
        positions: [
          expect.objectContaining({ positionNumber: 1, quantity: 36 }),
          expect.objectContaining({ positionNumber: 2, quantity: 24 }),
          expect.objectContaining({ positionNumber: 3, description: "Livraison", quantity: 1 }),
        ],
      }),
    );
  });

  it("ne touche pas un bon déjà réglé par sa facture", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "converti" }));
    expect(await syncSaleNote(ADMIN, SHOP, ORDER, NOW)).toEqual({ kind: "rien" });
    expect(deps.updateDeliveryNote).not.toHaveBeenCalled();
  });

  it("dit pourquoi le bon n'a pas suivi quand AbaNinja refuse", async () => {
    deps.updateDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    const outcome = await syncSaleNote(ADMIN, SHOP, ORDER, NOW);
    expect(outcome).toMatchObject({ kind: "echec" });
    expect(outcome.kind === "echec" ? outcome.message : "").toContain("injoignable");
  });
});

describe("le bon de livraison suit l'annulation de la commande", () => {
  it("annule le bon pour de bon et s'en souvient", async () => {
    expect(await cancelSaleNote(SHOP, ORDER)).toEqual({ kind: "fait" });
    expect(deps.cancelDeliveryNote).toHaveBeenCalledWith(CONFIG_VALUE, NOTE);
    expect(deps.markNote).toHaveBeenCalledWith(ORDER, { state: "annule" });
  });

  it("ne refait rien à la deuxième annulation (bouton puis webhook)", async () => {
    deps.findSale.mockResolvedValue(success({ ...SALE, noteState: "annule" }));
    expect(await cancelSaleNote(SHOP, ORDER)).toEqual({ kind: "rien" });
    expect(deps.cancelDeliveryNote).not.toHaveBeenCalled();
  });

  it("ignore la ligne d'une autre boutique", async () => {
    expect(await cancelSaleNote("autre.myshopify.com", ORDER)).toEqual({ kind: "rien" });
    expect(deps.cancelDeliveryNote).not.toHaveBeenCalled();
  });

  it("garde le bon tel quel si AbaNinja ne l'annule pas", async () => {
    deps.cancelDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    expect(await cancelSaleNote(SHOP, ORDER)).toMatchObject({ kind: "echec" });
    expect(deps.markNote).not.toHaveBeenCalled();
  });
});
