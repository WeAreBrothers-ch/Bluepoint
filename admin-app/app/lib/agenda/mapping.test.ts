import { describe, expect, it } from "vitest";
import { orderNode } from "./fixtures";
import { orderToTask, readDeliveryStatus } from "./mapping";

describe("orderToTask", () => {
  it("lit les métachamps de livraison", () => {
    const result = orderToTask(
      orderNode({
        dateSouhaitee: { value: "2026-10-22" },
        dateLimite: { value: "2026-10-24" },
        mode: { value: "poste" },
        displayFinancialStatus: "PENDING",
      }),
    );
    expect(result).toMatchObject({
      orderId: "gid://shopify/Order/1042",
      customerName: "Claire Monnier",
      city: "Cully",
      requestedDate: "2026-10-22",
      deadline: "2026-10-24",
      dateSource: "metachamp",
      mode: "poste",
      financialStatus: "PENDING",
      isPro: false,
      company: null,
    });
  });

  it("se replie sur les attributs du panier sans métachamp", () => {
    const result = orderToTask(
      orderNode({
        customAttributes: [
          { key: "Date de livraison souhaitée", value: "23.10.2026" },
          { key: "Livrer au plus tard", value: "2026-10-27" },
        ],
      }),
    );
    expect(result).toMatchObject({ requestedDate: "2026-10-23", deadline: "2026-10-27", dateSource: "attribut" });
  });

  it("donne « sans date » sans métachamp ni attribut", () => {
    expect(orderToTask(orderNode())).toMatchObject({ requestedDate: null, deadline: null, dateSource: "aucune" });
  });

  it("préfère les métachamps aux attributs", () => {
    const result = orderToTask(
      orderNode({ dateLimite: { value: "2026-10-30" }, customAttributes: [{ key: "Livrer au plus tard", value: "2026-10-01" }] }),
    );
    expect(result).toMatchObject({ requestedDate: null, deadline: "2026-10-30", dateSource: "metachamp" });
  });

  it("reconnaît une commande B2B et le nom de l'entreprise", () => {
    const result = orderToTask(
      orderNode({ purchasingEntity: { __typename: "PurchasingCompany", company: { name: "Le Pressoir SA" } } }),
    );
    expect(result).toMatchObject({ isPro: true, company: "Le Pressoir SA" });
  });

  it("tolère une entité acheteuse absente et lit l'étiquette « pro »", () => {
    const result = orderToTask(
      orderNode({
        purchasingEntity: null,
        customer: { displayName: "Paul", tags: [" Pro "] },
        shippingAddress: { name: null, city: " ", company: "Café du Port" },
      }),
    );
    expect(result).toMatchObject({ isPro: true, company: "Café du Port", city: null });
  });

  it("ignore un mode inconnu, une date invalide et les commandes annulées", () => {
    expect(orderToTask(orderNode({ mode: { value: "drone" }, dateLimite: { value: "2026-13-01" } }))).toMatchObject({
      mode: null,
      deadline: null,
    });
    expect(orderToTask(orderNode({ cancelledAt: "2026-10-20T10:00:00Z" }))).toBeNull();
    expect(orderToTask(orderNode({ id: "gid://shopify/Product/1" }))).toBeNull();
  });

  it("nomme un client sans nom", () => {
    expect(orderToTask(orderNode({ customer: null, shippingAddress: null }))?.customerName).toBe("Client sans nom");
  });
});

describe("readDeliveryStatus", () => {
  it("distingue expédiée et livrée", () => {
    const fulfilled = { displayFulfillmentStatus: "FULFILLED" };
    expect(readDeliveryStatus({ ...fulfilled, fulfillments: [{ status: "SUCCESS", displayStatus: "FULFILLED" }] })).toBe("expediee");
    expect(readDeliveryStatus({ ...fulfilled, fulfillments: [{ status: "SUCCESS", displayStatus: "DELIVERED" }] })).toBe("livree");
    expect(
      readDeliveryStatus({
        ...fulfilled,
        fulfillments: [
          { status: "CANCELLED", displayStatus: "CANCELED" },
          { status: "SUCCESS", displayStatus: "PICKED_UP" },
        ],
      }),
    ).toBe("livree");
  });

  it("signale les expéditions partielles et les commandes à livrer", () => {
    expect(readDeliveryStatus({ displayFulfillmentStatus: "PARTIALLY_FULFILLED", fulfillments: [] })).toBe("partielle");
    expect(readDeliveryStatus({ displayFulfillmentStatus: "UNFULFILLED", fulfillments: [] })).toBe("a_livrer");
  });
});
