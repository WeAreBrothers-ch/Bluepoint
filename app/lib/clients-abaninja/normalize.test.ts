import { describe, expect, it } from "vitest";
import { namesMatch, normalizeEmail, normalizeName } from "./normalize";

describe("normalizeEmail", () => {
  it("met en minuscules et retire les espaces", () => {
    expect(normalizeEmail(" Info@Resto.CH ")).toBe("info@resto.ch");
  });

  it("refuse ce qui n'est pas une adresse e-mail", () => {
    expect(normalizeEmail("pas un mail")).toBeNull();
    expect(normalizeEmail("nom@domaine")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("normalizeName", () => {
  it("retire accents, ponctuation et forme juridique", () => {
    expect(normalizeName("Restaurant du Lac Sàrl")).toBe("restaurant du lac");
    expect(normalizeName("  Café-Bar  L'Étoile SA ")).toBe("cafe bar l etoile");
  });

  it("écrit « & » en toutes lettres", () => {
    expect(normalizeName("Vins & Co GmbH")).toBe("vins et co");
  });

  it("renvoie une chaîne vide quand il n'y a rien", () => {
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName(" SA ")).toBe("");
  });
});

describe("namesMatch", () => {
  it("reconnaît deux noms égaux une fois nettoyés", () => {
    expect(namesMatch("Restaurant du Lac Sàrl", "restaurant du lac")).toBe(true);
  });

  it("reconnaît un nom contenu dans l'autre, en mots entiers", () => {
    expect(namesMatch("Brasserie de la Gare", "Brasserie de la Gare Lutry")).toBe(true);
  });

  it("ignore un nom trop court contenu dans l'autre", () => {
    expect(namesMatch("Bar", "Bar du Port")).toBe(false);
  });

  it("ne coupe pas un mot en deux", () => {
    expect(namesMatch("Hotel du Parc", "Hotel du Parcours")).toBe(false);
  });

  it("ne rapproche jamais deux noms vides", () => {
    expect(namesMatch("", " SA ")).toBe(false);
  });
});
