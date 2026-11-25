import { describe, expect, it } from "vitest";
import { planFiche } from "./plan";
import type { FicheState } from "./state";

const EMPTY: FicheState = {
  customerId: "gid://shopify/Customer/7",
  companyName: "ZELIG",
  firstName: null,
  lastName: null,
  phone: null,
  location: { id: "gid://shopify/CompanyLocation/10", phone: null, shippingAddress: null, hasBillingAddress: false },
};

const ADDRESS = { street: "Rue de Bourg 3", postalCode: "1003", city: "Lausanne", country: "CH" } as const;

describe("ce que la fiche écrit dans Shopify", () => {
  it("remplit la personne, le téléphone du restaurant et les deux adresses quand tout manque", () => {
    const plan = planFiche(EMPTY, { name: { firstName: "Lea", lastName: "Rochat" }, phone: "+41791234567", address: ADDRESS });
    expect(plan).toEqual({
      customer: { id: "gid://shopify/Customer/7", firstName: "Lea", lastName: "Rochat", phone: "+41791234567" },
      locationPhone: "+41791234567",
      address: {
        address: {
          address1: "Rue de Bourg 3",
          zip: "1003",
          city: "Lausanne",
          countryCode: "CH",
          firstName: "Lea",
          lastName: "Rochat",
          phone: "+41791234567",
        },
        addressTypes: ["SHIPPING", "BILLING"],
      },
    });
  });

  it("ne touche ni au téléphone du restaurant ni à l'adresse de facturation déjà enregistrés", () => {
    const state: FicheState = {
      ...EMPTY,
      firstName: "Lea",
      lastName: "Rochat",
      location: { ...EMPTY.location, phone: "+41213122092", hasBillingAddress: true },
    };
    const plan = planFiche(state, { name: null, phone: "+41791234567", address: ADDRESS });
    expect(plan.customer).toEqual({ id: "gid://shopify/Customer/7", phone: "+41791234567" });
    expect(plan.locationPhone).toBeNull();
    expect(plan.address?.addressTypes).toEqual(["SHIPPING"]);
    expect(plan.address?.address).toMatchObject({ firstName: "Lea", lastName: "Rochat", phone: "+41791234567" });
  });

  it("n'écrit rien sur la personne quand seule l'adresse manquait", () => {
    const state: FicheState = { ...EMPTY, firstName: "Lea", lastName: "Rochat", phone: "+41791234567" };
    const plan = planFiche(state, { name: null, phone: null, address: ADDRESS });
    expect(plan.customer).toBeNull();
    expect(plan.locationPhone).toBeNull();
    expect(plan.address?.address.phone).toBe("+41791234567");
  });
});
