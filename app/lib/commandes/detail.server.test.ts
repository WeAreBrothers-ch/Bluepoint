import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { frenchTypography } from "../abaninja/trial-typography";
import { orderNode } from "../agenda/fixtures";
import { success } from "../core/result";
import type { OrderDetailNode } from "./detail";

/** La fiche commande branche bien « déjà facturée ou livrée » sur le bon de livraison : pas de bouton alors. */

const deps = vi.hoisted(() => ({
  runAdminGraphql: vi.fn(),
  findInvoiceByOrder: vi.fn(),
  findSale: vi.fn(),
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../shopify/graphql.server", () => ({ runAdminGraphql: deps.runAdminGraphql }));
vi.mock("../agenda/payment-terms.server", () => ({ loadPaymentTerms: vi.fn(async () => new Map()) }));
vi.mock("../factures/repository.server", () => ({ findInvoiceByOrder: deps.findInvoiceByOrder, listInvoices: vi.fn(async () => []) }));
vi.mock("../factures/shortcuts.server", () => ({ channelsByCustomer: vi.fn(() => new Map()), invoiceShortcuts: vi.fn(() => null) }));
vi.mock("../reglages/settings.server", () => ({ loadCompleteSettings: vi.fn(async () => null) }));
vi.mock("../abaninja/vente-repository.server", () => ({ findSale: deps.findSale }));
vi.mock("../shopify/access.server", () => ({ grantedScopes: vi.fn(async () => null) }));
vi.mock("../commande/reads.server", () => ({ loadCatalog: vi.fn(async () => success({ products: [], truncated: false })) }));
vi.mock("./change.server", () => ({ ORDER_EDIT_SCOPE: "write_order_edits" }));

const { loadOrderPage } = await import("./detail.server");

const ADMIN = {} as AdminApiContext;
const SHOP = "test.myshopify.com";
const NOW = new Date("2026-11-19T11:05:30Z");
const TOO_LATE = { text: frenchTypography("Facture faite avant les bons de livraison : pas de bon pour cette commande."), tone: "info", canCreate: false };
const DELIVERED = { status: "SUCCESS", displayStatus: "FULFILLED", createdAt: "2026-11-18T09:00:00Z" };

function testOrder(overrides: Partial<OrderDetailNode> = {}): OrderDetailNode {
  return {
    ...orderNode({ displayFinancialStatus: "PENDING" }),
    tags: ["fictif"],
    createdAt: "2026-11-19T09:30:00Z",
    email: "luca.fictif@example.com",
    currentTotalDiscountsSet: null,
    currentShippingPriceSet: null,
    currentTotalTaxSet: null,
    discountApplications: { nodes: [] },
    detailLines: { nodes: [] },
    ...overrides,
  };
}

async function saleNoteOf(order: OrderDetailNode) {
  deps.runAdminGraphql.mockResolvedValue(success({ order }));
  return (await loadOrderPage(ADMIN, SHOP, "1042", NOW)).saleNote;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.findInvoiceByOrder.mockResolvedValue(null);
  deps.findSale.mockResolvedValue(success(null));
});

describe("fiche commande : le bouton du bon de livraison", () => {
  it("commande d'essai ni facturée ni livrée : le bouton est proposé", async () => {
    expect(await saleNoteOf(testOrder())).toMatchObject({ canCreate: true });
  });

  it("copie de facture déjà dans l'app : pas de bouton, et la raison", async () => {
    deps.findInvoiceByOrder.mockResolvedValue({ id: "copie-1", shop: SHOP, orderId: "gid://shopify/Order/1042", number: "R02291" });
    expect(await saleNoteOf(testOrder())).toEqual(TOO_LATE);
  });

  it("commande déjà livrée : pas de bouton, et la raison", async () => {
    expect(await saleNoteOf(testOrder({ fulfillments: [DELIVERED] }))).toEqual(TOO_LATE);
  });
});
