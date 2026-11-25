import { describe, expect, it } from "vitest";
import { describeMissing, ficheStateFrom, missingParts, type FicheState } from "./state";
import type { FicheCustomerData } from "./documents";

const COMPLETE: FicheState = {
  customerId: "gid://shopify/Customer/1",
  companyName: "Café de Grancy",
  firstName: "Lea",
  lastName: "Rochat",
  phone: "+41791234567",
  location: {
    id: "gid://shopify/CompanyLocation/10",
    phone: "+41213122092",
    shippingAddress: { address1: "Rond-Point 1", zip: "1006", city: "Lausanne" },
    hasBillingAddress: true,
  },
};

function customerData(overrides: Partial<NonNullable<FicheCustomerData["customer"]>> = {}): FicheCustomerData {
  const location = (id: string, address1: string | null) => ({
    companyLocation: {
      id: `gid://shopify/CompanyLocation/${id}`,
      phone: null,
      shippingAddress: address1 === null ? null : { address1, zip: "1003", city: "Lausanne" },
      billingAddress: null,
    },
  });
  return {
    customer: {
      id: "gid://shopify/Customer/7",
      firstName: null,
      lastName: "  ",
      defaultPhoneNumber: null,
      companyContactProfiles: [
        { company: { name: "Petit Boeuf" }, roleAssignments: { nodes: [location("10", null), location("11", "Rue de Bourg 3")] } },
      ],
      ...overrides,
    },
  };
}

describe("ce qui manque à une fiche pro", () => {
  it("ne demande rien quand prénom, nom, téléphone et adresse de livraison sont là", () => {
    expect(missingParts(COMPLETE)).toEqual([]);
  });

  it("demande le nom si le prénom ou le nom manque (un blanc compte comme vide)", () => {
    expect(missingParts({ ...COMPLETE, lastName: " " })).toEqual(["name"]);
    expect(missingParts({ ...COMPLETE, firstName: null })).toEqual(["name"]);
  });

  it("demande le téléphone de la personne, même si le restaurant en a un", () => {
    expect(missingParts({ ...COMPLETE, phone: null })).toEqual(["phone"]);
  });

  it("demande l'adresse de livraison si elle manque ou n'a ni rue, ni NPA, ni localité", () => {
    const location = COMPLETE.location;
    expect(missingParts({ ...COMPLETE, location: { ...location, shippingAddress: null } })).toEqual(["address"]);
    expect(missingParts({ ...COMPLETE, location: { ...location, shippingAddress: { address1: "Rond-Point 1", zip: "", city: "Lausanne" } } })).toEqual(["address"]);
  });

  it("dit ce qui manque en une phrase", () => {
    expect(describeMissing(["phone"])).toBe("votre numéro de téléphone");
    expect(describeMissing(["name", "address"])).toBe("votre nom et l’adresse de livraison");
    expect(describeMissing(["name", "phone", "address"])).toBe("votre nom, votre numéro de téléphone et l’adresse de livraison");
  });
});

describe("lecture de la fiche dans Shopify", () => {
  it("prend l'établissement choisi sur le site s'il est bien celui du client", () => {
    const state = ficheStateFrom(customerData(), "11");
    expect(state?.location.id).toBe("gid://shopify/CompanyLocation/11");
    expect(state?.companyName).toBe("Petit Boeuf");
    expect(state?.lastName).toBeNull();
  });

  it("prend le premier établissement quand rien n'est choisi ou que le choix ne lui appartient pas", () => {
    expect(ficheStateFrom(customerData(), null)?.location.id).toBe("gid://shopify/CompanyLocation/10");
    expect(ficheStateFrom(customerData(), "999")?.location.id).toBe("gid://shopify/CompanyLocation/10");
  });

  it("reconnaît un client qui n'est pas pro, ou introuvable", () => {
    expect(ficheStateFrom(customerData({ companyContactProfiles: [] }), null)).toBeNull();
    expect(ficheStateFrom({ customer: null }, null)).toBeNull();
  });

  it("lit le téléphone de la personne et note si l'adresse de facturation existe", () => {
    const state = ficheStateFrom(customerData({ defaultPhoneNumber: { phoneNumber: "+41791234567" } }), null);
    expect(state?.phone).toBe("+41791234567");
    expect(state?.location.hasBillingAddress).toBe(false);
  });
});
