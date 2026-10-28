import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, decideReplay, type StoredRequest } from "./idempotency";

const NOW = new Date("2026-10-21T10:00:00Z");

function request(overrides: Partial<StoredRequest> = {}): StoredRequest {
  return {
    shop: "boutique.myshopify.com",
    status: "en_cours",
    draftOrderId: null,
    draftOrderName: null,
    orderId: null,
    orderName: null,
    paymentPending: false,
    updatedAt: new Date(NOW.getTime() - 1000),
    ...overrides,
  };
}

describe("decideReplay", () => {
  it("double clic pendant la création : on attend", () => {
    expect(decideReplay(request(), "boutique.myshopify.com", NOW)).toEqual({ kind: "en_cours" });
  });

  it("saisie abandonnée sans provisoire : on la reprend", () => {
    const stale = request({ updatedAt: new Date(NOW.getTime() - STALE_AFTER_MS - 1) });
    expect(decideReplay(stale, "boutique.myshopify.com", NOW)).toEqual({ kind: "reprendre" });
  });

  it("commande déjà créée : on renvoie la même, sans doublon", () => {
    const done = request({ status: "terminee", orderId: "gid://shopify/Order/5", orderName: "#1005", paymentPending: true });
    expect(decideReplay(done, "boutique.myshopify.com", NOW)).toEqual({
      kind: "deja_terminee",
      orderId: "gid://shopify/Order/5",
      orderName: "#1005",
      paymentPending: true,
    });
  });

  it("provisoire créée mais pas terminée : on la termine", () => {
    const draft = request({ status: "a_terminer", draftOrderId: "gid://shopify/DraftOrder/8", draftOrderName: "#D8" });
    expect(decideReplay(draft, "boutique.myshopify.com", NOW).kind).toBe("terminer");
  });

  it("provisoire laissée exprès : on ne la termine pas", () => {
    const draft = request({ status: "brouillon", draftOrderId: "gid://shopify/DraftOrder/8", draftOrderName: "#D8" });
    expect(decideReplay(draft, "boutique.myshopify.com", NOW).kind).toBe("brouillon");
  });

  it("clé d'une autre boutique : refusée", () => {
    expect(decideReplay(request(), "autre.myshopify.com", NOW)).toEqual({ kind: "refusee" });
  });
});
