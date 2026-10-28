import { describe, expect, it } from "vitest";
import { EMPTY_PRO_REQUEST, isRobot, parseProRequest, readProRequestForm, type ProRequestValues } from "./request";

const valid: ProRequestValues = {
  ...EMPTY_PRO_REQUEST,
  companyName: " Restaurant du Lac ",
  firstName: "Anne",
  lastName: "Dupuis",
  email: "Anne@Restaurant-Lac.ch",
  phone: "079 123 45 67",
  street: "Quai Perdonnet 1",
  postalCode: "1800",
  city: "Vevey",
  country: "CH",
};

describe("demande de compte pro", () => {
  it("accepte une demande complète et la met au propre", () => {
    const parsed = parseProRequest(valid);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toMatchObject({
      companyName: "Restaurant du Lac",
      email: "anne@restaurant-lac.ch",
      phone: "+41791234567",
      vatNumber: null,
      message: null,
    });
  });

  it("vérifie le numéro TVA quand il est donné", () => {
    const good = parseProRequest({ ...valid, vatNumber: "CHE-116.281.710" });
    expect(good.ok && good.value.vatNumber).toBe("CHE-116.281.710 TVA");
    const bad = parseProRequest({ ...valid, vatNumber: "CHE-123.456.789" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.vatNumber).toMatch(/Laissez vide/);
  });

  it("explique chaque champ à corriger et garde ce qui a été tapé", () => {
    const parsed = parseProRequest({ ...valid, companyName: "", email: "pas-un-email", phone: "12", postalCode: "180" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(["companyName", "email", "phone", "postalCode"]);
    expect(parsed.errors.companyName).toBe("Le nom de l’entreprise est obligatoire.");
    expect(parsed.values.email).toBe("pas-un-email");
  });

  it("lit le formulaire et repère les robots", () => {
    const form = new URLSearchParams({ companyName: "Cave", email: "a@b.ch", site_web: "" });
    expect(readProRequestForm(form)).toMatchObject({ companyName: "Cave", email: "a@b.ch", country: "CH", phone: "" });
    expect(isRobot(form)).toBe(false);
    expect(isRobot(new URLSearchParams({ site_web: "http://spam.example" }))).toBe(true);
  });
});
