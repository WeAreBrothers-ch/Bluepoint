import { describe, expect, it } from "vitest";
import type { AbaNinjaRecord } from "./abaninja-schema";
import { isPrivateCustomersCard, toCard, unreadableReason } from "./cards";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

function record(overrides: Partial<AbaNinjaRecord> = {}): AbaNinjaRecord {
  return { uuid: UUID, ...overrides };
}

describe("toCard : société", () => {
  const company = record({
    customer_number: "A0153",
    name: " Restaurant du Lac Sàrl ",
    vat_number: "CHE-123.456.789 TVA",
    language: "FR",
    tags: ["Restaurant"],
    contacts: [
      { type: "phone", value: "021 123 45 67", is_primary: false },
      { type: "email", value: "compta@lac.ch", is_primary: false },
      { type: "email", value: "Info@Lac.ch", is_primary: true },
    ],
    contact_persons: [
      { first_name: "Marie", last_name: "Rochat", contacts: [{ type: "email", value: "marie@lac.ch" }, { type: "mobile", value: "079 111 22 33" }] },
    ],
    addresses: [{ address: "Quai du Lac", street_number: "4", zip_code: "1095", city: "Lutry", country_code: "ch" }],
  });

  it("met l'e-mail principal en premier, puis les autres et ceux des personnes de contact", () => {
    expect(toCard(company, "company")?.emails).toEqual(["info@lac.ch", "compta@lac.ch", "marie@lac.ch"]);
  });

  it("reprend nom, numéro, contact, téléphone, adresse et langue", () => {
    expect(toCard(company, "company")).toMatchObject({
      uuid: UUID,
      kind: "company",
      number: "A0153",
      name: "Restaurant du Lac Sàrl",
      firstName: "Marie",
      lastName: "Rochat",
      phone: "+41211234567",
      address: { street: "Quai du Lac 4", extra: null, zip: "1095", city: "Lutry", countryCode: "CH" },
      vatNumber: "CHE-123.456.789 TVA",
      language: "fr",
      tags: ["Restaurant"],
    });
  });

  it("lit les étiquettes écrites en texte ou en objet", () => {
    expect(toCard(record({ name: "Bar", tags: ["Fournisseur", { name: "Vaud" }, 4, " "] }), "company")?.tags).toEqual(["Fournisseur", "Vaud"]);
  });

  it("lit un numéro client écrit en chiffres", () => {
    expect(toCard(record({ name: "Bar", customer_number: 1120 }), "company")?.number).toBe("1120");
  });
});

describe("toCard : personne", () => {
  it("compose le nom et laisse l'adresse vide si elle est incomplète", () => {
    const card = toCard(
      record({ first_name: "Luc", last_name: "Favre", addresses: [{ address: "Rue Neuve 1", zip_code: "", city: "Vevey" }] }),
      "person",
    );
    expect(card).toMatchObject({ kind: "person", name: "Luc Favre", firstName: "Luc", lastName: "Favre", address: null, emails: [], phone: null });
  });

  it("n'invente pas de fiche sans nom", () => {
    expect(toCard(record({ first_name: " ", last_name: null }), "person")).toBeNull();
    expect(toCard(record({ name: "" }), "company")).toBeNull();
  });
});

describe("isPrivateCustomersCard", () => {
  it("reconnaît la fiche qui regroupe les particuliers, par numéro ou par nom", () => {
    const byNumber = toCard(record({ name: "Divers", customer_number: "1062" }), "company");
    const byName = toCard(record({ name: "Clients privés" }), "company");
    const other = toCard(record({ name: "Restaurant du Lac", customer_number: "A0153" }), "company");
    expect(byNumber !== null && isPrivateCustomersCard(byNumber)).toBe(true);
    expect(byName !== null && isPrivateCustomersCard(byName)).toBe(true);
    expect(other !== null && isPrivateCustomersCard(other)).toBe(false);
  });

  it("n'envoie pas à Shopify un code pays qu'il ne comprendrait pas", () => {
    const withCountry = (country_code: string | null) =>
      toCard({ uuid: UUID, name: "Bar", addresses: [{ address: "Rue 1", zip_code: "1000", city: "Lausanne", country_code }] }, "company")?.address;
    expect(withCountry("fr")?.countryCode).toBe("FR");
    expect(withCountry(null)?.countryCode).toBe("CH");
    expect(withCountry("Suisse")).toBeNull();
  });
});

describe("unreadableReason", () => {
  it("nomme le champ refusé et le type attendu, sans recopier la valeur", () => {
    const reason = unreadableReason({ uuid: UUID, name: "Hôtel du Parc", vat_number: 123456789 });
    expect(reason).toContain("vat_number");
    expect(reason).not.toContain("123456789");
    expect(reason).not.toContain("Hôtel");
  });

  it("remplace les numéros de ligne par # pour regrouper les fiches", () => {
    expect(unreadableReason({ uuid: UUID, name: "Bar", contacts: [{ type: "email", value: 5 }] })).toContain("contacts.#.value");
  });

  it("dit « sans nom » quand la fiche se lit mais n'a pas de nom", () => {
    expect(unreadableReason(record({ name: " " }))).toBe("sans nom");
  });
});
