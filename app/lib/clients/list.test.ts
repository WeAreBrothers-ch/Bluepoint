import { describe, expect, it } from "vitest";
import { clientsHref, clientsSearchQuery, cleanClientTerm, toClientListItem, type ClientStatsNode } from "./list";

function client(overrides: Partial<ClientStatsNode> = {}): ClientStatsNode {
  return {
    id: "gid://shopify/Customer/24668789014852",
    displayName: "Hugo Fictif",
    tags: [],
    lastOrder: null,
    firstName: "Hugo",
    lastName: "Fictif",
    numberOfOrders: "3",
    amountSpent: { amount: "367.2", currencyCode: "CHF" },
    defaultEmailAddress: { emailAddress: "hugo@example.ch" },
    defaultPhoneNumber: { phoneNumber: "+41790000103" },
    defaultAddress: {
      firstName: "Hugo",
      lastName: "Fictif",
      company: "Brasserie de la Gare",
      address1: "Place de la Gare 2",
      address2: null,
      zip: "1110",
      city: "Morges",
      provinceCode: null,
      countryCodeV2: "CH",
      phone: null,
      formatted: [],
    },
    ...overrides,
  };
}

describe("recherche des clients", () => {
  it("nettoie ce qui a été tapé", () => {
    expect(cleanClientTerm('  Le "Chalet" (Vevey) ')).toBe("Le Chalet Vevey");
  });

  it("combine l'onglet et ce qui a été tapé", () => {
    expect(clientsSearchQuery("tous", "")).toBe("");
    expect(clientsSearchQuery("tous", "Favre")).toBe("Favre");
    expect(clientsSearchQuery("pros", "")).toBe("(tag:pro OR tag:professionnel OR tag:b2b)");
    expect(clientsSearchQuery("pros", "Favre")).toBe("(tag:pro OR tag:professionnel OR tag:b2b) AND Favre");
  });

  it("garde l'onglet, la recherche et la page dans l'adresse", () => {
    expect(clientsHref("tous", "")).toBe("/app/clients");
    expect(clientsHref("pros", "Le Chalet", "abc")).toBe("/app/clients?onglet=pros&q=Le+Chalet&apres=abc");
  });
});

describe("un client de la liste", () => {
  it("lit l'entreprise, le nombre de commandes et le total", () => {
    const item = toClientListItem(client());
    expect(item?.company).toBe("Brasserie de la Gare");
    expect(item?.ordersCount).toBe(3);
    expect(item?.spentCents).toBe(36720);
    expect(item?.customer.phone).toBe("+41790000103");
  });

  it("n'invente pas d'entreprise pour un particulier", () => {
    const item = toClientListItem(client({ defaultAddress: null }));
    expect(item?.company).toBeNull();
  });

  it("ne donne pas de total pour une autre devise, et lit un nombre de commandes illisible comme zéro", () => {
    const item = toClientListItem(client({ amountSpent: { amount: "10.0", currencyCode: "EUR" }, numberOfOrders: "n/a" }));
    expect(item?.spentCents).toBeNull();
    expect(item?.ordersCount).toBe(0);
  });

  it("repère un client pro à son étiquette", () => {
    expect(toClientListItem(client({ tags: ["Pro"] }))?.customer.isPro).toBe(true);
    expect(toClientListItem(client())?.customer.isPro).toBe(false);
  });

  it("ignore un client dont l'identifiant est illisible", () => {
    expect(toClientListItem(client({ id: "n'importe quoi" }))).toBeNull();
  });
});
