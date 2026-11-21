import { describe, expect, it } from "vitest";
import { companyInput, type ProAccountInput } from "./company-input";

const full: ProAccountInput = {
  companyName: "Restaurant du Lac",
  firstName: "Marie",
  lastName: "Rochat",
  email: "info@lac.ch",
  phone: "+41211234567",
  street: "Quai du Lac 4",
  postalCode: "1095",
  city: "Lutry",
  country: "CH",
  vatNumber: "CHE-123.456.789 TVA",
};

describe("companyInput", () => {
  it("décrit l'entreprise, son établissement à l'adresse donnée et son contact", () => {
    expect(companyInput(full, "gid://shopify/PaymentTermsTemplate/4", true)).toMatchObject({
      company: { name: "Restaurant du Lac" },
      companyLocation: {
        name: "Restaurant du Lac",
        phone: "+41211234567",
        shippingAddress: { address1: "Quai du Lac 4", zip: "1095", city: "Lutry", countryCode: "CH", firstName: "Marie", lastName: "Rochat" },
        billingSameAsShipping: true,
        taxRegistrationId: "CHE-123.456.789 TVA",
        buyerExperienceConfiguration: { paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/4" },
      },
      companyContact: { email: "info@lac.ch", firstName: "Marie", lastName: "Rochat", phone: "+41211234567" },
    });
  });

  it("n'envoie pas d'adresse incomplète", () => {
    const input = companyInput({ ...full, street: null }, null, false);
    expect(input.companyLocation).not.toHaveProperty("shippingAddress");
    expect(input.companyLocation).not.toHaveProperty("billingSameAsShipping");
    expect(input).not.toHaveProperty("companyContact");
  });

  it("n'envoie ni nom, ni prénom, ni téléphone vides", () => {
    const input = companyInput({ ...full, firstName: null, lastName: null, phone: null }, null, true);
    expect(input.companyContact).toEqual({ email: "info@lac.ch", locale: "fr" });
    expect(input.companyLocation).not.toHaveProperty("phone");
    expect(input.companyLocation.shippingAddress).toEqual({ address1: "Quai du Lac 4", zip: "1095", city: "Lutry", countryCode: "CH" });
  });
});
