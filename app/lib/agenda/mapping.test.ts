import { describe, expect, it } from "vitest";
import { address, orderNode } from "./fixtures";
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
        customer: { displayName: "Paul", tags: [" Pro "], defaultPhoneNumber: null },
        shippingAddress: address({ name: null, city: " ", company: "Café du Port" }),
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

  it("lit l'adresse, le téléphone, la remarque, les vins et le total pour la carte de livraison", () => {
    const result = orderToTask(
      orderNode({
        note: "  Code porte 1234  ",
        currentTotalPriceSet: { shopMoney: { amount: "168.3", currencyCode: "CHF" } },
        customer: { displayName: "Marc", tags: [], defaultPhoneNumber: { phoneNumber: "+41791234567" } },
        shippingAddress: address({ address1: "Quai Fictif 12", address2: " ", zip: "1095", city: "Lutry" }),
        lineItems: {
          nodes: [
            { name: "Passione di Re", currentQuantity: 2 },
            { name: "Retiré", currentQuantity: 0 },
          ],
        },
      }),
    );
    expect(result).toMatchObject({
      street: "Quai Fictif 12",
      zip: "1095",
      city: "Lutry",
      phone: "+41791234567",
      note: "Code porte 1234",
      items: [{ name: "Passione di Re", quantity: 2 }],
      totalCents: 16830,
    });
  });

  it("préfère le téléphone de livraison et ignore un total en devise étrangère", () => {
    const result = orderToTask(
      orderNode({
        currentTotalPriceSet: { shopMoney: { amount: "10.00", currencyCode: "EUR" } },
        customer: { displayName: "Marc", tags: [], defaultPhoneNumber: { phoneNumber: "+41791234567" } },
        shippingAddress: address({ phone: "021 555 01 23" }),
      }),
    );
    expect(result).toMatchObject({ phone: "021 555 01 23", totalCents: null });
  });

  it("prend le mode de livraison du panier sans métachamp", () => {
    const result = orderToTask(orderNode({ customAttributes: [{ key: "Mode de livraison", value: "Retrait" }] }));
    expect(result?.mode).toBe("retrait");
  });

  it("date la livraison au jour suisse de la dernière expédition réussie", () => {
    const result = orderToTask(
      orderNode({
        fulfillments: [
          { status: "SUCCESS", displayStatus: "DELIVERED", createdAt: "2026-10-27T22:30:00Z" },
          { status: "CANCELLED", displayStatus: "CANCELED", createdAt: "2026-10-29T10:00:00Z" },
        ],
      }),
    );
    expect(result?.deliveredOn).toBe("2026-10-27");
    expect(orderToTask(orderNode())?.deliveredOn).toBeNull();
  });
});

describe("readDeliveryStatus", () => {
  it("distingue expédiée et livrée", () => {
    const fulfilled = { displayFulfillmentStatus: "FULFILLED" };
    expect(readDeliveryStatus({ ...fulfilled, fulfillments: [{ status: "SUCCESS", displayStatus: "FULFILLED", createdAt: "2026-10-21T10:00:00Z" }] })).toBe("expediee");
    expect(readDeliveryStatus({ ...fulfilled, fulfillments: [{ status: "SUCCESS", displayStatus: "DELIVERED", createdAt: "2026-10-21T10:00:00Z" }] })).toBe("livree");
    expect(
      readDeliveryStatus({
        ...fulfilled,
        fulfillments: [
          { status: "CANCELLED", displayStatus: "CANCELED", createdAt: "2026-10-20T10:00:00Z" },
          { status: "SUCCESS", displayStatus: "PICKED_UP", createdAt: "2026-10-21T10:00:00Z" },
        ],
      }),
    ).toBe("livree");
  });

  it("signale les expéditions partielles et les commandes à livrer", () => {
    expect(readDeliveryStatus({ displayFulfillmentStatus: "PARTIALLY_FULFILLED", fulfillments: [] })).toBe("partielle");
    expect(readDeliveryStatus({ displayFulfillmentStatus: "UNFULFILLED", fulfillments: [] })).toBe("a_livrer");
  });
});
