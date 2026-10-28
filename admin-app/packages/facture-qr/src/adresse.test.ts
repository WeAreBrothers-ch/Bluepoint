import { describe, expect, it } from "vitest";
import { lireRueShopify, separerRueEtNumero } from "./adresse";
import { FactureError } from "./erreurs";

describe("separerRueEtNumero", () => {
  it.each([
    ["Rue du Châtelard 44", "Rue du Châtelard", "44"],
    ["Chemin des Vignes 3b", "Chemin des Vignes", "3b"],
    ["Avenue de la Gare 12-14", "Avenue de la Gare", "12-14"],
    ["Avenue de la Gare 12 - 14", "Avenue de la Gare", "12-14"],
    ["Route de Lavaux 7 bis", "Route de Lavaux", "7 bis"],
    ["Rue du Lac, 12", "Rue du Lac", "12"],
    ["Avenue du 1er-Mars 5", "Avenue du 1er-Mars", "5"],
    ["Bahnhofstrasse 1A", "Bahnhofstrasse", "1A"],
    ["  Grand-Rue   18  ", "Grand-Rue", "18"],
    ["44 rue du Châtelard", "rue du Châtelard", "44"],
    ["12, chemin de la Cure", "chemin de la Cure", "12"],
  ])("« %s » → rue « %s », numéro « %s »", (ligne, rue, numero) => {
    expect(separerRueEtNumero(ligne)).toEqual({ street: rue, buildingNumber: numero });
  });

  it.each(["Rue du Châtelard", "Rue du 31-Décembre", "Le Village", ""])("« %s » n'a pas de numéro", (ligne) => {
    expect(separerRueEtNumero(ligne)).toBeNull();
  });
});

describe("lireRueShopify", () => {
  it("prend le numéro saisi seul dans le complément d'adresse", () => {
    expect(lireRueShopify("Chemin des Vignes", "3b")).toEqual({ street: "Chemin des Vignes", buildingNumber: "3b" });
  });

  it("ignore un complément qui n'est pas un numéro", () => {
    expect(lireRueShopify("Rue du Châtelard 44", "2e étage")).toEqual({
      street: "Rue du Châtelard",
      buildingNumber: "44",
    });
  });

  it("explique quoi corriger quand le numéro manque", () => {
    expect(() => lireRueShopify("Rue du Châtelard", "c/o Dupont")).toThrow(FactureError);
    expect(() => lireRueShopify("Rue du Châtelard")).toThrow(/sans numéro de rue.*Corriger l'adresse/);
  });
});
