import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POLICES_INTEGREES } from "./polices-integrees";

const DOSSIER = new URL("../../assets/fonts/", import.meta.url);

describe("polices intégrées", () => {
  it("correspondent exactement aux fichiers de assets/fonts (sinon : npm run polices)", () => {
    const fichiers = readdirSync(DOSSIER).filter((fichier) => fichier.endsWith(".ttf"));
    expect(Object.keys(POLICES_INTEGREES).sort()).toEqual(fichiers.sort());
    for (const fichier of fichiers) {
      expect(POLICES_INTEGREES[fichier]).toBe(readFileSync(new URL(fichier, DOSSIER)).toString("base64"));
    }
  });
});
