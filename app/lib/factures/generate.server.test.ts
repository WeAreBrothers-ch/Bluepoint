import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvoiceInput } from "@bluepoint/facture-qr";
import { COMMANDE_SHOPIFY } from "../../../packages/facture-qr/src/fixtures/commande-shopify";
import { VENDEUR_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/vendeur";
import { success } from "../core/result";
import { parseGid } from "../shopify/ids";
import type { PaymentTransaction } from "./order-payment";

/**
 * Facture à la livraison : base, réglages et Shopify simulés ; le vrai moteur de facture calcule et valide,
 * seul le dessin du PDF est remplacé (on garde ce qu'il reçoit).
 */

const createdInvoices: Record<string, unknown>[] = [];
const renderedInputs: InvoiceInput[] = [];
let shopifyPayment: { displayFinancialStatus: string | null; transactions: readonly PaymentTransaction[] } = {
  displayFinancialStatus: "PENDING",
  transactions: [],
};

let orderTags: readonly string[] = [];
const abaninja = vi.hoisted(() => ({ ensureAbaNinjaTestInvoice: vi.fn(), ensureAbaNinjaSaleInvoice: vi.fn(), findSale: vi.fn() }));

const tx = {
  storedFile: { create: vi.fn(async () => ({})) },
  invoice: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      createdInvoices.push(data);
      return { id: "facture-1", ...data };
    }),
  },
};

vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("./repository.server", () => ({ findInvoiceByOrder: async () => null, invoicePdfKey: (shop: string, number: string) => `${shop}/${number}.pdf` }));
vi.mock("./numbering.server", () => ({ nextInvoiceSequence: async () => 7 }));
vi.mock("../reglages/settings.server", () => ({ loadCompleteSettings: async () => ({ paymentTermDays: 30 }) }));
vi.mock("../reglages/seller", () => ({ toInvoiceSeller: () => VENDEUR_EXEMPLE }));
vi.mock("../core/logger.server", () => ({ logError: vi.fn(), logInfo: vi.fn() }));
vi.mock("@bluepoint/facture-qr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bluepoint/facture-qr")>();
  return {
    ...actual,
    renderInvoicePdf: async (input: InvoiceInput) => {
      renderedInputs.push(input);
      return Buffer.from("%PDF-");
    },
  };
});
vi.mock("./shopify-order.server", () => ({
  fetchOrderForInvoice: async () =>
    success({
      order: COMMANDE_SHOPIFY,
      contact: {
        tags: orderTags,
        email: "client@exemple.test",
        phone: null,
        customer: null,
        shippingAddress: null,
        billingAddress: null,
        fulfillments: [{ status: "SUCCESS", createdAt: "2026-11-18T09:00:00Z", deliveredAt: null }],
        ...shopifyPayment,
      },
    }),
}));

vi.mock("./abaninja-facture.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./abaninja-facture.server")>()),
  ensureAbaNinjaTestInvoice: abaninja.ensureAbaNinjaTestInvoice,
}));

vi.mock("./abaninja-vente.server", () => ({ ensureAbaNinjaSaleInvoice: abaninja.ensureAbaNinjaSaleInvoice }));
vi.mock("../abaninja/vente-repository.server", () => ({ findSale: abaninja.findSale }));

const { ensureInvoice } = await import("./generate.server");

const admin = {} as Parameters<typeof ensureInvoice>[0];
const ORDER = parseGid("gid://shopify/Order/1042", "Order") ?? expect.unreachable("identifiant de commande invalide");
const NOW = new Date("2026-11-19T10:00:00Z");

beforeEach(() => {
  orderTags = [];
  vi.clearAllMocks();
  abaninja.ensureAbaNinjaTestInvoice.mockResolvedValue(success({ invoice: { id: "aba-1", number: "R02291" }, created: true, inAbaNinja: true }));
  abaninja.ensureAbaNinjaSaleInvoice.mockResolvedValue(success({ invoice: { id: "aba-2", number: "R02292" }, created: true, inAbaNinja: true, fromNote: true }));
  abaninja.findSale.mockResolvedValue(success(null));
  createdInvoices.length = 0;
  renderedInputs.length = 0;
});

describe("ensureInvoice : facture d'une commande livrée", () => {
  it("fait la QR-facture à 30 jours quand le client n'a pas encore payé", async () => {
    shopifyPayment = { displayFinancialStatus: "PENDING", transactions: [] };

    const result = await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(result.ok).toBe(true);
    expect(createdInvoices).toMatchObject([{ paidOn: null, issueDate: "2026-11-19", dueDate: "2026-12-19" }]);
    expect(renderedInputs[0]).toMatchObject({ paymentTerms: "Payable à 30 jours" });
    expect(renderedInputs[0]?.paidOn).toBeUndefined();
  });

  it("fait une facture acquittée, sans QR-facture, quand la commande est déjà payée", async () => {
    shopifyPayment = { displayFinancialStatus: "PAID", transactions: [{ kind: "SALE", status: "SUCCESS", processedAt: "2026-11-10T08:15:00Z" }] };

    const result = await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(result.ok).toBe(true);
    expect(createdInvoices).toMatchObject([{ paidOn: "2026-11-10", issueDate: "2026-11-19", dueDate: "2026-11-19" }]);
    expect(renderedInputs[0]).toMatchObject({ paidOn: "2026-11-10", paymentTerms: "Payée", deliveryDate: "2026-11-18" });
  });

  it("ne fait aucune facture quand la commande est payée en partie", async () => {
    shopifyPayment = { displayFinancialStatus: "PARTIALLY_PAID", transactions: [] };

    const result = await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(result).toMatchObject({ ok: false, error: { code: "paiement_partiel" } });
    expect(createdInvoices).toEqual([]);
  });
});

describe("ensureInvoice : commandes d'essai faites dans AbaNinja", () => {
  it("commande fictive à payer : la facture se fait dans AbaNinja, sans numéro BluePoint", async () => {
    orderTags = ["fictif"];
    shopifyPayment = { displayFinancialStatus: "PENDING", transactions: [] };

    const result = await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(result).toMatchObject({ ok: true, value: { inAbaNinja: true } });
    expect(abaninja.ensureAbaNinjaTestInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ shop: "boutique.myshopify.com", orderId: ORDER, deliveryDate: "2026-11-18", issueDate: "2026-11-19" }),
    );
    expect(createdInvoices).toEqual([]);
  });

  it("commande fictive déjà payée : facture acquittée BluePoint, comme avant", async () => {
    orderTags = ["fictif"];
    shopifyPayment = { displayFinancialStatus: "PAID", transactions: [{ kind: "SALE", status: "SUCCESS", processedAt: "2026-11-10T08:15:00Z" }] };

    await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(abaninja.ensureAbaNinjaTestInvoice).not.toHaveBeenCalled();
    expect(createdInvoices).toHaveLength(1);
  });

  it("vraie commande à payer : jamais AbaNinja", async () => {
    orderTags = ["pro"];
    shopifyPayment = { displayFinancialStatus: "PENDING", transactions: [] };

    await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(abaninja.ensureAbaNinjaTestInvoice).not.toHaveBeenCalled();
    expect(createdInvoices).toHaveLength(1);
  });
});

describe("ensureInvoice : commande d'essai dont le bon de livraison est dans AbaNinja", () => {
  const SALE = { shop: "boutique.myshopify.com", orderId: ORDER, noteState: "cree", invoiceState: null };

  it("à payer : la facture naît du bon (jamais une deuxième facture directe)", async () => {
    orderTags = ["fictif"];
    shopifyPayment = { displayFinancialStatus: "PENDING", transactions: [] };
    abaninja.findSale.mockResolvedValue(success(SALE));

    const result = await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(result).toMatchObject({ ok: true, value: { fromNote: true } });
    expect(abaninja.ensureAbaNinjaSaleInvoice).toHaveBeenCalledWith(SALE, expect.objectContaining({ orderId: ORDER, deliveryDate: "2026-11-18" }), null);
    expect(abaninja.ensureAbaNinjaTestInvoice).not.toHaveBeenCalled();
    expect(createdInvoices).toEqual([]);
  });

  it("payée : la facture naît du bon, avec la date et le moyen du paiement", async () => {
    orderTags = ["fictif"];
    shopifyPayment = { displayFinancialStatus: "PAID", transactions: [{ kind: "SALE", status: "SUCCESS", processedAt: "2026-11-10T08:15:00Z", gateway: "shopify_payments" }] };
    abaninja.findSale.mockResolvedValue(success(SALE));

    await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(abaninja.ensureAbaNinjaSaleInvoice).toHaveBeenCalledWith(SALE, expect.anything(), { paidOn: "2026-11-10", gateway: "shopify_payments" });
    expect(createdInvoices).toEqual([]);
  });

  it("bon refusé (rien dans AbaNinja) : facture directe, comme avant", async () => {
    orderTags = ["fictif"];
    shopifyPayment = { displayFinancialStatus: "PENDING", transactions: [] };
    abaninja.findSale.mockResolvedValue(success({ ...SALE, noteState: "refuse" }));

    await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(abaninja.ensureAbaNinjaSaleInvoice).not.toHaveBeenCalled();
    expect(abaninja.ensureAbaNinjaTestInvoice).toHaveBeenCalled();
  });

  it("vraie commande : jamais le bon, même si une ligne existait", async () => {
    orderTags = ["pro"];
    shopifyPayment = { displayFinancialStatus: "PENDING", transactions: [] };
    abaninja.findSale.mockResolvedValue(success(SALE));

    await ensureInvoice(admin, "boutique.myshopify.com", ORDER, NOW);

    expect(abaninja.ensureAbaNinjaSaleInvoice).not.toHaveBeenCalled();
    expect(createdInvoices).toHaveLength(1);
  });
});
