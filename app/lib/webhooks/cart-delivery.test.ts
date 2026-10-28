import { describe, expect, it } from "vitest";
import { metafieldsToSet, parseDeliveryMode, readCartDelivery } from "./cart-delivery";
import { readOrderCreated } from "./payloads";

const ORDER = "gid://shopify/Order/42";
const NONE = { livraison_date_souhaitee: false, livraison_date_limite: false, livraison_mode: false };

function attrs(entries: Record<string, string | null>) {
  return Object.entries(entries).map(([key, value]) => ({ key, value }));
}

describe("readCartDelivery", () => {
  it("lit les trois attributs du panier", () => {
    const delivery = readCartDelivery(
      attrs({ "Date de livraison souhaitée": "2026-10-23", "Livrer au plus tard": "2026-10-25", "Mode de livraison": "poste" }),
    );
    expect(delivery).toEqual({ requestedDate: "2026-10-23", deadline: "2026-10-25", mode: "poste", ignored: [] });
  });

  it("date limite absente = date souhaitée", () => {
    expect(readCartDelivery(attrs({ "Date de livraison souhaitée": "2026-10-23" })).deadline).toBe("2026-10-23");
  });

  it("écarte les valeurs illisibles sans rien deviner", () => {
    const delivery = readCartDelivery(
      attrs({ "Date de livraison souhaitée": "demain", "Livrer au plus tard": "2026-13-40", "Mode de livraison": "drone" }),
    );
    expect(delivery.requestedDate).toBeNull();
    expect(delivery.deadline).toBeNull();
    expect(delivery.mode).toBeNull();
    expect(delivery.ignored.map((item) => item.reason)).toEqual(["date_illisible", "date_illisible", "mode_inconnu"]);
  });

  it("refuse une date limite avant la date souhaitée et reprend la date souhaitée", () => {
    const delivery = readCartDelivery(attrs({ "Date de livraison souhaitée": "2026-10-23", "Livrer au plus tard": "2026-10-20" }));
    expect(delivery.deadline).toBe("2026-10-23");
    expect(delivery.ignored).toEqual([{ attribute: "Livrer au plus tard", reason: "limite_avant_souhaitee" }]);
  });

  it("ignore la casse et les espaces des noms d'attributs", () => {
    expect(readCartDelivery(attrs({ " mode de livraison ": "Retrait sur place" })).mode).toBe("retrait");
  });
});

describe("parseDeliveryMode", () => {
  it("accepte la valeur ou le libellé, sans accents ni majuscules", () => {
    expect(parseDeliveryMode("Livraison")).toBe("livraison");
    expect(parseDeliveryMode("Envoi par la Poste")).toBe("poste");
    expect(parseDeliveryMode("velo")).toBeNull();
  });
});

describe("metafieldsToSet", () => {
  const delivery = readCartDelivery(attrs({ "Date de livraison souhaitée": "2026-10-23", "Mode de livraison": "livraison" }));

  it("pose les métachamps $app manquants sur la commande", () => {
    expect(metafieldsToSet(ORDER, delivery, NONE)).toEqual([
      { ownerId: ORDER, namespace: "$app", key: "livraison_date_souhaitee", type: "date", value: "2026-10-23" },
      { ownerId: ORDER, namespace: "$app", key: "livraison_date_limite", type: "date", value: "2026-10-23" },
      { ownerId: ORDER, namespace: "$app", key: "livraison_mode", type: "single_line_text_field", value: "livraison" },
    ]);
  });

  it("n'écrase jamais un métachamp déjà posé (webhook renvoyé)", () => {
    const all = { livraison_date_souhaitee: true, livraison_date_limite: true, livraison_mode: true };
    expect(metafieldsToSet(ORDER, delivery, all)).toEqual([]);
    const partial = { ...NONE, livraison_mode: true };
    expect(metafieldsToSet(ORDER, delivery, partial).map((m) => m.key)).toEqual(["livraison_date_souhaitee", "livraison_date_limite"]);
  });

  it("ne pose rien sans attribut lisible", () => {
    expect(metafieldsToSet(ORDER, readCartDelivery([]), NONE)).toEqual([]);
  });
});

describe("readOrderCreated", () => {
  it("lit les attributs du panier de la charge utile", () => {
    const payload = {
      admin_graphql_api_id: ORDER,
      name: "#1042",
      note_attributes: [{ name: "Mode de livraison", value: "poste" }, { name: 3, value: "x" }, "bruit"],
    };
    expect(readOrderCreated(payload)?.noteAttributes).toEqual([{ key: "Mode de livraison", value: "poste" }]);
  });

  it("supporte une commande sans attributs", () => {
    expect(readOrderCreated({ admin_graphql_api_id: ORDER, name: "#1" })?.noteAttributes).toEqual([]);
  });
});
