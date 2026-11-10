import { describe, expect, it } from "vitest";
import { multiLine, singleLine } from "./input-validation";

const INVISIBLES: readonly (readonly [string, string])[] = [
  ["marque bidirectionnelle U+202E", "Jean\u202Edupont"],
  ["isolat bidirectionnel U+2066", "Jean\u2066x\u2069"],
  ["zéro-largeur U+200B", "Jean\u200BDupont"],
  ["espace insécable étroit joint U+2060", "Jean\u2060Dupont"],
  ["contrôle C1 U+0085", "Jean\u0085Dupont"],
  ["séparateur de ligne U+2028", "Jean\u2028Dupont"],
  ["séparateur de paragraphe U+2029", "Jean\u2029Dupont"],
  ["octet nul", "Jean\u0000Dupont"],
  ["DEL", "Jean\u007FDupont"],
];

describe("singleLine", () => {
  it("accepte un texte normal avec accents", () => {
    expect(singleLine(50).safeParse("  Rue de l'Étoile 3  ").data).toBe("Rue de l'Étoile 3");
  });

  it.each(INVISIBLES)("refuse : %s", (_label, value) => {
    expect(singleLine(50).safeParse(value).success).toBe(false);
  });

  it("refuse un retour à la ligne", () => {
    expect(singleLine(50).safeParse("a\nb").success).toBe(false);
  });
});

describe("multiLine", () => {
  it("autorise les retours à la ligne et tabulations", () => {
    expect(multiLine(50).safeParse("ligne 1\r\nligne 2\tfin").success).toBe(true);
  });

  it.each(INVISIBLES.filter(([label]) => !label.includes("U+2028") && !label.includes("U+2029")))(
    "refuse : %s",
    (_label, value) => {
      expect(multiLine(50).safeParse(value).success).toBe(false);
    },
  );

  it("refuse les séparateurs U+2028 et U+2029", () => {
    expect(multiLine(50).safeParse("a\u2028b").success).toBe(false);
    expect(multiLine(50).safeParse("a\u2029b").success).toBe(false);
  });
});
