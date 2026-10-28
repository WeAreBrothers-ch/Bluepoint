import { describe, expect, it } from "vitest";
import { CUSTOMER, order } from "./fixtures";
import { isPaymentTermsRefusal } from "./outcome";
import { buildCalculationInput, buildDraftOrderInput, buildPaymentTerms, cleanAddress, pickFulfillmentTemplate, pickNetTemplate } from "./payload";
import type { B2bPurchaser, ShippingAddress } from "./types";

const ADDRESS: ShippingAddress = {
  firstName: "Marco",
  lastName: "Rossi",
  company: "La Poésia",
  address1: "Rue du Lac 4",
  address2: " ",
  zip: "1095",
  city: "Lutry",
  provinceCode: "",
  countryCode: "CH",
  phone: null,
};

const B2B = {
  companyId: "gid://shopify/Company/1",
  companyContactId: "gid://shopify/CompanyContact/2",
  companyLocationId: "gid://shopify/CompanyLocation/3",
} as B2bPurchaser;

describe("buildDraftOrderInput", () => {
  it("construit la commande provisoire d'un client avec les métachamps $app", () => {
    const input = buildDraftOrderInput(order(), ADDRESS, null);
    expect(input.purchasingEntity).toEqual({ customerId: "gid://shopify/Customer/10" });
    expect(input.lineItems).toEqual([{ variantId: "gid://shopify/ProductVariant/1", quantity: 12 }]);
    expect(input.tags).toEqual(["telephone"]);
    expect(input.note).toBe("Sonner à l’arrière");
    expect(input.metafields).toEqual([
      { namespace: "$app", key: "livraison_date_souhaitee", type: "date", value: "2026-10-23" },
      { namespace: "$app", key: "livraison_date_limite", type: "date", value: "2026-10-24" },
      { namespace: "$app", key: "livraison_mode", type: "single_line_text_field", value: "livraison" },
    ]);
    expect(input.shippingAddress?.address2).toBeNull();
    expect(input.shippingAddress?.provinceCode).toBeNull();
    expect(input.paymentTerms).toBeUndefined();
  });

  it("passe par l'entreprise B2B et pose les conditions de paiement", () => {
    const terms = buildPaymentTerms("gid://shopify/PaymentTermsTemplate/4", new Date("2026-10-21T08:00:00Z"));
    const input = buildDraftOrderInput(order({ b2b: B2B, note: "  " }), null, terms);
    expect(input.purchasingEntity).toEqual({ purchasingCompany: B2B });
    expect(input.shippingAddress).toBeUndefined();
    expect(input.note).toBeUndefined();
    expect(input.paymentTerms).toEqual({
      paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/4",
      paymentSchedules: [{ issuedAt: "2026-10-21T08:00:00.000Z" }],
    });
  });

  it("calcule les prix du client avec les remises automatiques, sans métachamps ni étiquettes", () => {
    const lines = [{ variantId: order().lines[0]!.variantId, quantity: 6 }];
    expect(buildCalculationInput(CUSTOMER, B2B, lines)).toEqual({
      purchasingEntity: { purchasingCompany: B2B },
      acceptAutomaticDiscounts: true,
      lineItems: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 6 }],
    });
    expect(buildCalculationInput(CUSTOMER, null, lines).purchasingEntity).toEqual({ customerId: CUSTOMER });
  });

  it("applique les remises automatiques (prix pro) à la commande", () => {
    expect(buildDraftOrderInput(order(), null, null).acceptAutomaticDiscounts).toBe(true);
  });

  it("pose des conditions « à l'expédition » sans échéancier", () => {
    expect(buildPaymentTerms("gid://shopify/PaymentTermsTemplate/9", null)).toEqual({
      paymentTermsTemplateId: "gid://shopify/PaymentTermsTemplate/9",
    });
  });
});

describe("cleanAddress", () => {
  it("écarte une adresse sans rue ni localité", () => {
    expect(cleanAddress({ ...ADDRESS, address1: "", city: " " })).toBeNull();
    expect(cleanAddress(null)).toBeNull();
  });
});

describe("pickNetTemplate", () => {
  const templates = [
    { id: "t1", name: "Due on receipt", paymentTermsType: "RECEIPT", dueInDays: null },
    { id: "t7", name: "Net 7", paymentTermsType: "NET", dueInDays: 7 },
    { id: "t30", name: "Net 30", paymentTermsType: "NET", dueInDays: 30 },
    { id: "t60", name: "Net 60", paymentTermsType: "NET", dueInDays: 60 },
  ];

  it("prend le délai exact", () => {
    expect(pickNetTemplate(templates, 30)).toEqual({ template: templates[2], exact: true });
  });

  it("prend le délai supérieur le plus proche, sinon le plus long", () => {
    expect(pickNetTemplate(templates, 20)?.template.id).toBe("t30");
    expect(pickNetTemplate(templates, 20)?.exact).toBe(false);
    expect(pickNetTemplate(templates, 120)?.template.id).toBe("t60");
  });

  it("renvoie null sans modèle net", () => {
    expect(pickNetTemplate([templates[0]!], 30)).toBeNull();
  });

  it("trouve le modèle « à l'expédition » pour le paiement à la livraison", () => {
    const fulfillment = { id: "t9", name: "Due on fulfillment", paymentTermsType: "FULFILLMENT", dueInDays: null };
    expect(pickFulfillmentTemplate([...templates, fulfillment])).toEqual({ template: fulfillment, exact: true });
    expect(pickFulfillmentTemplate(templates)).toBeNull();
  });
});

describe("isPaymentTermsRefusal", () => {
  it("reconnaît un refus des conditions de paiement", () => {
    expect(isPaymentTermsRefusal([{ field: ["input", "paymentTerms"], message: "Not allowed" }])).toBe(true);
    expect(isPaymentTermsRefusal([{ field: null, message: "Payment terms are not available on this plan" }])).toBe(true);
    expect(isPaymentTermsRefusal([{ field: ["lineItems", "0"], message: "Variant not found" }])).toBe(false);
  });
});
