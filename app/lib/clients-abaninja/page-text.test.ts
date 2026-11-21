import { describe, expect, it } from "vitest";
import { compareCards } from "./match";
import { moreCardsLabel, pageLevelResult } from "./page-text";
import { card, client, side, UUID_PARC } from "./test-builders";
import { toComparisonView } from "./view";

const absentView = toComparisonView(compareCards([card()], side([])), side([]), { cards: [card()], skipped: 0, truncated: false });

function result(intent: string | null, fiche: string | null) {
  return { ok: false, intent, fiche, message: "Refusé" };
}

describe("pageLevelResult", () => {
  it("montre en haut de la page ce qui n'a pas de place ailleurs", () => {
    expect(pageLevelResult(result(null, null), absentView)).toEqual(result(null, null));
  });

  it("montre en haut le résultat d'un lot dont le bouton a disparu", () => {
    expect(pageLevelResult(result("relier_tous", null), absentView)).toEqual(result("relier_tous", null));
    expect(pageLevelResult(result("creer_tous", null), absentView)).toEqual(result("creer_tous", null));
  });

  it("laisse le résultat sur la fiche quand elle est encore affichée avec ses boutons", () => {
    expect(pageLevelResult(result("creer", card().uuid), absentView)).toBeUndefined();
  });

  it("montre en haut le résultat d'une fiche partie dans « Déjà reliées »", () => {
    const linked = side([client({ link: { uuid: card().uuid, kind: "company", number: null }, proReady: true })]);
    const linkedView = toComparisonView(compareCards([card()], linked), linked, { cards: [card()], skipped: 0, truncated: false });
    expect(pageLevelResult(result("relier", card().uuid), linkedView)).toEqual(result("relier", card().uuid));
  });

  it("ne montre rien sans résultat, ni pour une fiche mise de côté (elle a sa ligne)", () => {
    expect(pageLevelResult(undefined, absentView)).toBeUndefined();
    const ignored = side([], [UUID_PARC]);
    const parc = card({ uuid: UUID_PARC });
    const ignoredView = toComparisonView(compareCards([parc], ignored), ignored, { cards: [parc], skipped: 0, truncated: false });
    expect(pageLevelResult(result("ignorer", UUID_PARC), ignoredView)).toBeUndefined();
  });
});

describe("moreCardsLabel", () => {
  it("accorde le nombre et dit combien il en reste", () => {
    expect(moreCardsLabel(1)).toBe("Voir 1 fiche de plus");
    expect(moreCardsLabel(20)).toBe("Voir 20 fiches de plus");
    expect(moreCardsLabel(45)).toBe("Voir 20 fiches de plus (encore 45)");
  });
});
