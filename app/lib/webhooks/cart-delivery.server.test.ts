import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import type { OrderGid } from "../shopify/ids";

/** Nouvelle commande : le mode vient du panier (pros) ou du choix fait au paiement (particuliers). */

const deps = vi.hoisted(() => ({ runAdminGraphql: vi.fn(), setMetafields: vi.fn() }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../shopify/graphql.server", () => ({ runAdminGraphql: deps.runAdminGraphql }));
vi.mock("../commande/writes.server", () => ({ setMetafields: deps.setMetafields }));

const { copyCartDeliveryToMetafields } = await import("./cart-delivery.server");

const ADMIN = {} as AdminApiContext;
const ORDER = "gid://shopify/Order/42" as OrderGid;

function orderState(methodTypes: readonly string[], mode: string | null = null) {
  return success({
    order: {
      id: ORDER,
      dateSouhaitee: null,
      dateLimite: null,
      mode: mode === null ? null : { value: mode },
      fulfillmentOrders: { nodes: methodTypes.map((methodType) => ({ deliveryMethod: { methodType } })) },
    },
  });
}

function writtenModes(): string[] {
  const [, metafields] = deps.setMetafields.mock.calls[0] as [unknown, { key: string; value: string }[]];
  return metafields.filter((metafield) => metafield.key === "livraison_mode").map((metafield) => metafield.value);
}

beforeEach(() => {
  vi.clearAllMocks();
  deps.setMetafields.mockResolvedValue(success(undefined));
});

describe("copyCartDeliveryToMetafields", () => {
  it("particulier qui retire au dépôt : mode « retrait » sans rien au panier", async () => {
    deps.runAdminGraphql.mockResolvedValue(orderState(["PICK_UP"]));
    await expect(copyCartDeliveryToMetafields(ADMIN, ORDER, [])).resolves.toBe("fait");
    expect(writtenModes()).toEqual(["retrait"]);
  });

  it("particulier qui paie le port : mode « poste »", async () => {
    deps.runAdminGraphql.mockResolvedValue(orderState(["SHIPPING"]));
    await expect(copyCartDeliveryToMetafields(ADMIN, ORDER, [])).resolves.toBe("fait");
    expect(writtenModes()).toEqual(["poste"]);
  });

  it("pro : le camion choisi au panier est gardé, avec la date", async () => {
    deps.runAdminGraphql.mockResolvedValue(orderState(["SHIPPING"]));
    const attributes = [
      { key: "Mode de livraison", value: "livraison" },
      { key: "Date de livraison souhaitée", value: "2026-11-25" },
    ];
    await expect(copyCartDeliveryToMetafields(ADMIN, ORDER, attributes)).resolves.toBe("fait");
    expect(writtenModes()).toEqual(["livraison"]);
  });

  it("un mode déjà posé (commande faite dans l'app) n'est jamais réécrit", async () => {
    deps.runAdminGraphql.mockResolvedValue(orderState(["PICK_UP"], "livraison"));
    await expect(copyCartDeliveryToMetafields(ADMIN, ORDER, [])).resolves.toBe("rien_a_faire");
    expect(deps.setMetafields).not.toHaveBeenCalled();
  });

  it("rien de connu (pas de livraison au paiement, rien au panier) : rien n'est écrit", async () => {
    deps.runAdminGraphql.mockResolvedValue(orderState([]));
    await expect(copyCartDeliveryToMetafields(ADMIN, ORDER, [])).resolves.toBe("rien_a_faire");
    expect(deps.setMetafields).not.toHaveBeenCalled();
  });

  it("Shopify ne répond pas : à réessayer, sans rien écrire", async () => {
    deps.runAdminGraphql.mockResolvedValue(failure(new Error("panne")));
    await expect(copyCartDeliveryToMetafields(ADMIN, ORDER, [])).resolves.toBe("a_reessayer");
    expect(deps.setMetafields).not.toHaveBeenCalled();
  });
});
