import { describe, expect, it } from "vitest";
import { EMPTY_NEW_CUSTOMER, parseNewCustomer, prefillFromSearch, toCustomerInput } from "./new-customer";

const base = { ...EMPTY_NEW_CUSTOMER, firstName: "Anne", lastName: "Dupuis", phone: "079 123 45 67" };

describe("nouveau client depuis « Prendre une commande »", () => {
  it("se contente du nom et du téléphone", () => {
    const parsed = parseNewCustomer(base);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({ phone: "+41791234567", email: null, street: "" });
    expect(toCustomerInput(parsed.value)).toEqual({ firstName: "Anne", lastName: "Dupuis", phone: "+41791234567", locale: "fr" });
  });

  it("demande une adresse complète quand elle est commencée", () => {
    const parsed = parseNewCustomer({ ...base, street: "Rue du Lac 4" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(["city", "postalCode"]);
    const complete = parseNewCustomer({ ...base, street: "Rue du Lac 4", postalCode: "1095", city: "Lutry", email: "Anne@Exemple.ch" });
    expect(complete.ok && toCustomerInput(complete.value)).toMatchObject({
      email: "anne@exemple.ch",
      addresses: [{ address1: "Rue du Lac 4", zip: "1095", city: "Lutry", countryCode: "CH" }],
    });
  });

  it("refuse un téléphone ou un e-mail illisible", () => {
    const parsed = parseNewCustomer({ ...base, phone: "12", email: "pas-un-email" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(Object.keys(parsed.errors).sort()).toEqual(["email", "phone"]);
  });

  it("reprend ce qui a été tapé dans la recherche", () => {
    expect(prefillFromSearch("079 123 45 67")).toMatchObject({ phone: "079 123 45 67", firstName: "" });
    expect(prefillFromSearch("Anne Dupuis Martin")).toMatchObject({ firstName: "Anne", lastName: "Dupuis Martin" });
    expect(prefillFromSearch("  ")).toEqual(EMPTY_NEW_CUSTOMER);
  });
});
