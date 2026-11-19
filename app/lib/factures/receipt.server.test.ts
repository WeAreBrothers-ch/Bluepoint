import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { parseGid } from "../shopify/ids";
import type { ReceiptFacts } from "./pro-order";

const deps = vi.hoisted(() => ({ fetchReceiptFacts: vi.fn(), findSale: vi.fn(), ensureReceipt: vi.fn(), emailInvoice: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("./receipt-query", () => ({ fetchReceiptFacts: deps.fetchReceiptFacts }));
vi.mock("../abaninja/vente-repository.server", () => ({ findSale: deps.findSale }));
vi.mock("./generate.server", () => ({ ensureReceipt: deps.ensureReceipt }));
vi.mock("./send.server", () => ({ emailInvoice: deps.emailInvoice }));

const { issueReceiptOnPayment } = await import("./receipt.server");

const ADMIN = {} as AdminApiContext;
const SHOP = "test.myshopify.com";
const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
const PRO_PAID: ReceiptFacts = { customerTags: ["pro"], purchasingEntityType: null, financialStatus: "PAID", plannedDeliveryDate: null, isTest: false };
const TEST_SALE = { shop: SHOP, orderId: ORDER, isTest: true, noteState: "cree" };

beforeEach(() => {
  vi.clearAllMocks();
  deps.fetchReceiptFacts.mockResolvedValue(success(PRO_PAID));
  deps.findSale.mockResolvedValue(success(null));
  deps.ensureReceipt.mockResolvedValue(success({ invoice: { id: "f1", number: "BP-2026-0042" }, created: true }));
  deps.emailInvoice.mockResolvedValue(success(undefined));
});

describe("reçu pro d'une commande payée en ligne", () => {
  it("vraie commande pro payée : reçu fait et envoyé", async () => {
    await issueReceiptOnPayment(ADMIN, SHOP, ORDER);
    expect(deps.ensureReceipt).toHaveBeenCalledTimes(1);
    expect(deps.emailInvoice).toHaveBeenCalledWith(ADMIN, SHOP, "f1");
  });

  it("étiquette « fictif » retirée après le bon : pas de reçu BluePoint, la facture naîtra du bon", async () => {
    deps.findSale.mockResolvedValue(success(TEST_SALE));
    await issueReceiptOnPayment(ADMIN, SHOP, ORDER);
    expect(deps.ensureReceipt).not.toHaveBeenCalled();
    expect(deps.emailInvoice).not.toHaveBeenCalled();
  });

  it("bon refusé (rien dans AbaNinja) : le reçu se fait comme d'habitude", async () => {
    deps.findSale.mockResolvedValue(success({ ...TEST_SALE, noteState: "refuse" }));
    await issueReceiptOnPayment(ADMIN, SHOP, ORDER);
    expect(deps.ensureReceipt).toHaveBeenCalledTimes(1);
  });

  it("base illisible : pas de reçu (il reste faisable depuis « Factures »), jamais un doublon", async () => {
    deps.findSale.mockResolvedValue(failure(new Error("base en panne")));
    await issueReceiptOnPayment(ADMIN, SHOP, ORDER);
    expect(deps.ensureReceipt).not.toHaveBeenCalled();
  });
});
