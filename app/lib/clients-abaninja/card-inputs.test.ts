import { describe, expect, it } from "vitest";
import { cardLink, toMailingAddress, toPersonCustomerInput, toProAccountInput } from "./card-inputs";
import { card, UUID_FAVRE, UUID_LAC } from "./test-builders";

describe("cardLink", () => {
  it("garde l'uuid, le type et le numéro de la fiche", () => {
    expect(cardLink(card())).toEqual({ uuid: UUID_LAC, kind: "company", number: "A0153" });
  });
});

describe("toProAccountInput", () => {
  it("reprend la société, son contact, son adresse et un numéro TVA valable", () => {
    expect(toProAccountInput(card({ vatNumber: "CHE-116.281.710 TVA" }), "info@lac.ch", "+41211234567")).toEqual({
      companyName: "Restaurant du Lac Sàrl",
      firstName: "Marie",
      lastName: "Rochat",
      email: "info@lac.ch",
      phone: "+41211234567",
      street: "Quai du Lac 4",
      postalCode: "1095",
      city: "Lutry",
      country: "CH",
      vatNumber: "CHE-116.281.710 TVA",
    });
  });

  it("laisse de côté une TVA illisible et une adresse absente", () => {
    expect(toProAccountInput(card({ vatNumber: "123", address: null }), "info@lac.ch", null)).toMatchObject({
      vatNumber: null,
      phone: null,
      street: null,
      postalCode: null,
      city: null,
      country: "CH",
    });
  });
});

describe("toPersonCustomerInput", () => {
  const favre = card({ uuid: UUID_FAVRE, kind: "person", number: "1120", name: "Luc Favre", firstName: "Luc", lastName: "Favre", language: "de" });

  it("crée une fiche avec le lien, la langue et une note, sans abonnement", () => {
    const input = toPersonCustomerInput(favre, "luc@favre.ch", "+41791112233");
    expect(input).toEqual({
      email: "luc@favre.ch",
      firstName: "Luc",
      lastName: "Favre",
      phone: "+41791112233",
      locale: "de",
      note: "Repris d’AbaNinja (fiche n° 1120).",
      metafields: [{ namespace: "$app", key: "abaninja", type: "json", value: JSON.stringify({ uuid: UUID_FAVRE, kind: "person", number: "1120" }) }],
    });
    expect(input).not.toHaveProperty("emailMarketingConsent");
  });

  it("n'envoie ni téléphone ni langue inconnus", () => {
    const input = toPersonCustomerInput(card({ kind: "person", language: "es", number: null }), "a@b.ch", null);
    expect(input).not.toHaveProperty("phone");
    expect(input).not.toHaveProperty("locale");
    expect(input.note).toBe("Repris d’AbaNinja.");
  });
});

describe("toMailingAddress", () => {
  it("écrit l'adresse AbaNinja pour Shopify", () => {
    expect(toMailingAddress(card({ address: { street: "Rue Neuve 1", extra: "2e étage", zip: "1800", city: "Vevey", countryCode: "CH" } }))).toEqual({
      address1: "Rue Neuve 1",
      address2: "2e étage",
      zip: "1800",
      city: "Vevey",
      countryCode: "CH",
      company: "Restaurant du Lac Sàrl",
      firstName: "Marie",
      lastName: "Rochat",
    });
  });

  it("renvoie null sans adresse", () => {
    expect(toMailingAddress(card({ address: null }))).toBeNull();
  });
});
