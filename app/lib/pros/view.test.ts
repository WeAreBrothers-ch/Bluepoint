import type { ProRequest } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { toProRequestView } from "./view";

function request(over: Partial<ProRequest> = {}): ProRequest {
  return {
    id: "r1",
    shop: "boutique.myshopify.com",
    status: "en_attente",
    source: "site",
    companyName: "Café de la Gare",
    firstName: "Sophie",
    lastName: "Rochat",
    email: "sophie@cafe.ch",
    phone: "+41791234567",
    street: "Avenue de la Gare 12",
    postalCode: "1003",
    city: "Lausanne",
    country: "CH",
    vatNumber: null,
    message: null,
    companyId: null,
    customerId: null,
    createdAt: new Date("2026-11-17T15:05:00Z"),
    decidedAt: null,
    ...over,
  };
}

describe("demande pro affichée", () => {
  it("dit le jour et l'heure (suisse) d'arrivée, pour voir l'ordre des demandes", () => {
    expect(toProRequestView(request()).receivedLabel).toBe("Reçue par le site le mardi 17 novembre à\u00A016:05");
    expect(toProRequestView(request({ source: "app" })).receivedLabel).toBe("Ajoutée dans l’app le mardi 17 novembre à\u00A016:05");
  });

  it("prépare le lien pour appeler d'un toucher", () => {
    expect(toProRequestView(request()).callHref).toBe("tel:+41791234567");
    expect(toProRequestView(request({ phone: "pas un numéro" })).callHref).toBeNull();
  });
});
