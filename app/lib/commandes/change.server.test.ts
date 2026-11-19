import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { success } from "../core/result";

/** « Modifier les vins » sur une commande dont le vin est écrit à la main (#1038 : Moscarossa sans lien au catalogue). */

const deps = vi.hoisted(() => ({ runAdminGraphql: vi.fn(), runAdminMutation: vi.fn(), findInvoiceByOrder: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../shopify/graphql.server", () => ({ runAdminGraphql: deps.runAdminGraphql, runAdminMutation: deps.runAdminMutation }));
vi.mock("../factures/repository.server", () => ({ findInvoiceByOrder: deps.findInvoiceByOrder }));

const { handleOrderChange } = await import("./change.server");

const ADMIN = {} as AdminApiContext;
const ORDER = "gid://shopify/Order/1038";
const MOSCAROSSA = "gid://shopify/LineItem/2";
const CALCULATED = "gid://shopify/CalculatedOrder/9";

function orderWithHandWine(quantity: number) {
  return {
    order: {
      id: ORDER,
      name: "#1038",
      cancelledAt: null,
      displayFinancialStatus: "PENDING",
      displayFulfillmentStatus: "UNFULFILLED",
      currentTotalPriceSet: { shopMoney: { amount: "192.0" } },
      lineItems: { nodes: [{ id: MOSCAROSSA, currentQuantity: quantity, variant: null }] },
    },
  };
}

/** Faux Shopify : chaque étape de la modification répond sans erreur. */
function shopifyAccepts(_admin: AdminApiContext, mutation: string) {
  if (mutation.includes("orderEditBegin")) {
    return success({ calculatedOrder: { id: CALCULATED, lineItems: { nodes: [{ id: "gid://shopify/CalculatedLineItem/2", variant: null }] } }, userErrors: [] });
  }
  if (mutation.includes("orderEditCommit")) return success({ order: { id: ORDER, currentTotalPriceSet: { shopMoney: { amount: "96.0" } } }, userErrors: [] });
  return success({ calculatedOrder: { id: CALCULATED }, userErrors: [] });
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries({ intent: "modifier", orderId: ORDER, quantities: "{}", ...fields })) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.runAdminGraphql.mockResolvedValue(success(orderWithHandWine(12)));
  deps.runAdminMutation.mockImplementation(async (admin: AdminApiContext, mutation: string) => shopifyAccepts(admin, mutation));
  deps.findInvoiceByOrder.mockResolvedValue(null);
});

describe("modifier un vin écrit à la main", () => {
  it("enlève un carton : Shopify reçoit la nouvelle quantité de cette ligne, puis enregistre", async () => {
    const result = await handleOrderChange(ADMIN, form({ lignes: JSON.stringify({ [MOSCAROSSA]: 6 }) }));
    expect(result).toMatchObject({ ok: true, intent: "modifier" });
    expect(deps.runAdminMutation).toHaveBeenCalledWith(ADMIN, expect.stringContaining("orderEditSetQuantity"), expect.any(Function), {
      id: CALCULATED,
      lineItemId: "gid://shopify/CalculatedLineItem/2",
      quantity: 6,
    });
    expect(deps.runAdminMutation).toHaveBeenLastCalledWith(ADMIN, expect.stringContaining("orderEditCommit"), expect.any(Function), { id: CALCULATED });
  });

  it("page ouverte avant ce changement (rien d'envoyé pour la ligne) : la commande ne bouge pas", async () => {
    expect(await handleOrderChange(ADMIN, form({}))).toMatchObject({ ok: true, message: expect.stringContaining("Rien n’a changé") });
    expect(deps.runAdminMutation).not.toHaveBeenCalled();
  });

  it("le dernier carton ne s'enlève pas : il faut annuler la commande", async () => {
    deps.runAdminGraphql.mockResolvedValue(success(orderWithHandWine(6)));
    expect(await handleOrderChange(ADMIN, form({ lignes: JSON.stringify({ [MOSCAROSSA]: 0 }) }))).toMatchObject({ ok: false, message: expect.stringContaining("annulez plutôt") });
    expect(deps.runAdminMutation).not.toHaveBeenCalled();
  });

  it("envoi abîmé : refusé, rien n'est demandé à Shopify", async () => {
    expect(await handleOrderChange(ADMIN, form({ lignes: "{abîmé" }))).toMatchObject({ ok: false });
    expect(deps.runAdminGraphql).not.toHaveBeenCalled();
  });
});
