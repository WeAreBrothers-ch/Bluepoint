import { describe, expect, it } from "vitest";
import { EMPTY_FICHE, fieldsFor, parseFiche, readFicheForm, type FicheValues } from "./form";

const TYPED: FicheValues = {
  firstName: " Lea ",
  lastName: "Rochat",
  phone: "079 123 45 67",
  street: "Rond-Point 1",
  postalCode: "1006",
  city: "Lausanne",
  country: "CH",
};

describe("formulaire de la fiche pro", () => {
  it("ne montre que les champs de ce qui manque", () => {
    expect(fieldsFor(["phone"])).toEqual(["phone"]);
    expect(fieldsFor(["name", "address"])).toEqual(["firstName", "lastName", "street", "postalCode", "city", "country"]);
  });

  it("lit le formulaire champ par champ, Suisse par défaut", () => {
    const form = new URLSearchParams({ phone: "079 123 45 67", inconnu: "x" });
    expect(readFicheForm(form)).toEqual({ ...EMPTY_FICHE, phone: "079 123 45 67" });
  });

  it("vérifie seulement ce qui manque et ignore le reste (on ne remplace rien de déjà enregistré)", () => {
    const parsed = parseFiche(["phone"], { ...TYPED, street: "" });
    expect(parsed).toEqual({ ok: true, value: { name: null, phone: "+41791234567", address: null } });
  });

  it("rend le nom, le téléphone au format international et l'adresse", () => {
    const parsed = parseFiche(["name", "phone", "address"], TYPED);
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: { firstName: "Lea", lastName: "Rochat" },
        phone: "+41791234567",
        address: { street: "Rond-Point 1", postalCode: "1006", city: "Lausanne", country: "CH" },
      },
    });
  });

  it("dit quoi corriger, avec les mêmes phrases que la demande de compte pro", () => {
    const parsed = parseFiche(["name", "phone", "address"], { ...TYPED, firstName: "", phone: "12", postalCode: "10" });
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors).toEqual({
      firstName: "Le prénom est obligatoire.",
      phone: "Numéro de téléphone invalide (exemple : 079 123 45 67).",
      postalCode: "NPA à 4 chiffres (exemple : 1095).",
    });
    expect(parsed.values.city).toBe("Lausanne");
  });
});
