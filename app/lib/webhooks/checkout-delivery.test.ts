import { describe, expect, it } from "vitest";
import { chooseDeliveryMode, readCheckoutDelivery } from "./checkout-delivery";

describe("readCheckoutDelivery", () => {
  it("retrait au dépôt quand toute la commande est à retirer", () => {
    expect(readCheckoutDelivery(["PICK_UP"])).toBe("retrait");
    expect(readCheckoutDelivery(["PICK_UP", "PICK_UP"])).toBe("retrait");
  });

  it("envoi pour une expédition, une livraison locale ou un point relais", () => {
    expect(readCheckoutDelivery(["SHIPPING"])).toBe("envoi");
    expect(readCheckoutDelivery(["LOCAL"])).toBe("envoi");
    expect(readCheckoutDelivery(["PICKUP_POINT"])).toBe("envoi");
  });

  it("inconnu sans information, avec un mélange ou un type sans livraison", () => {
    expect(readCheckoutDelivery([])).toBe("inconnu");
    expect(readCheckoutDelivery(["PICK_UP", "SHIPPING"])).toBe("inconnu");
    expect(readCheckoutDelivery(["NONE"])).toBe("inconnu");
    expect(readCheckoutDelivery(["RETAIL"])).toBe("inconnu");
  });
});

describe("chooseDeliveryMode", () => {
  it("particulier sans choix au panier : le paiement donne le mode", () => {
    expect(chooseDeliveryMode(null, "retrait")).toEqual({ mode: "retrait", contradicted: false });
    expect(chooseDeliveryMode(null, "envoi")).toEqual({ mode: "poste", contradicted: false });
    expect(chooseDeliveryMode(null, "inconnu")).toEqual({ mode: null, contradicted: false });
  });

  it("pro : le choix du panier est gardé quand le paiement va dans le même sens", () => {
    expect(chooseDeliveryMode("livraison", "envoi")).toEqual({ mode: "livraison", contradicted: false });
    expect(chooseDeliveryMode("poste", "envoi")).toEqual({ mode: "poste", contradicted: false });
    expect(chooseDeliveryMode("retrait", "retrait")).toEqual({ mode: "retrait", contradicted: false });
    expect(chooseDeliveryMode("livraison", "inconnu")).toEqual({ mode: "livraison", contradicted: false });
  });

  it("retrait choisi au paiement : il l'emporte sur le panier, et c'est signalé", () => {
    expect(chooseDeliveryMode("livraison", "retrait")).toEqual({ mode: "retrait", contradicted: true });
    expect(chooseDeliveryMode("poste", "retrait")).toEqual({ mode: "retrait", contradicted: true });
  });

  it("retrait au panier mais port payé : le panier est gardé, et c'est signalé", () => {
    expect(chooseDeliveryMode("retrait", "envoi")).toEqual({ mode: "retrait", contradicted: true });
  });
});
