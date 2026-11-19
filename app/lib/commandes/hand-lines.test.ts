import { describe, expect, it } from "vitest";
import { MAX_LINE_QUANTITY } from "../commande/types";
import { handQuantitiesFromLines, parseWantedHandLines, planWithHandLines, setHandQuantity } from "./hand-lines";

/** Les vins écrits à la main dans Shopify (sans lien avec le catalogue) se changent aussi, par cartons. */

const PASSIONE = "gid://shopify/ProductVariant/11";
const MOSCAROSSA = "gid://shopify/LineItem/2";
const FRAIS = "gid://shopify/LineItem/3";

const lines = [
  { lineItemId: "gid://shopify/LineItem/1", variantId: PASSIONE, quantity: 6 },
  { lineItemId: MOSCAROSSA, variantId: null, quantity: 12 },
  { lineItemId: FRAIS, variantId: null, quantity: 1 },
];

describe("vins écrits à la main", () => {
  it("part des lignes à la main en cartons complets ; les frais et autres articles restent à part", () => {
    expect(handQuantitiesFromLines(lines)).toEqual({ [MOSCAROSSA]: 12 });
  });

  it("enlève un carton d'un vin écrit à la main", () => {
    expect(planWithHandLines(lines, { [PASSIONE]: 6 }, { [MOSCAROSSA]: 6 })).toEqual({ set: [{ lineItemId: MOSCAROSSA, quantity: 6 }], add: [] });
  });

  it("retire tout le vin écrit à la main, en plus des changements du catalogue", () => {
    expect(planWithHandLines(lines, { [PASSIONE]: 12 }, { [MOSCAROSSA]: 0 })).toEqual({
      set: [
        { lineItemId: "gid://shopify/LineItem/1", quantity: 12 },
        { lineItemId: MOSCAROSSA, quantity: 0 },
      ],
      add: [],
    });
  });

  it("une ligne à la main absente de l'envoi (page d'avant) reste telle quelle", () => {
    expect(planWithHandLines(lines, { [PASSIONE]: 6 }, {})).toEqual({ set: [], add: [] });
  });

  it("ne touche jamais une ligne qui n'est pas un vin à la main en cartons (frais, ligne du catalogue)", () => {
    const wanted = { [FRAIS]: 0, "gid://shopify/LineItem/1": 0 };
    expect(planWithHandLines(lines, { [PASSIONE]: 6 }, wanted)).toEqual({ set: [], add: [] });
  });

  it("le nombre choisi reste entre zéro et le maximum, comme pour les vins du catalogue", () => {
    expect(setHandQuantity({ [MOSCAROSSA]: 12 }, MOSCAROSSA, 6)).toEqual({ [MOSCAROSSA]: 6 });
    expect(setHandQuantity({ [MOSCAROSSA]: 6 }, MOSCAROSSA, -6)).toEqual({ [MOSCAROSSA]: 0 });
    expect(setHandQuantity({}, MOSCAROSSA, MAX_LINE_QUANTITY + 6)).toEqual({ [MOSCAROSSA]: MAX_LINE_QUANTITY });
  });

  it("lit les quantités envoyées par la page : rien d'envoyé = rien à changer, le reste abîmé = refusé", () => {
    expect(parseWantedHandLines(null)).toEqual({});
    expect(parseWantedHandLines(JSON.stringify({ [MOSCAROSSA]: 0 }))).toEqual({ [MOSCAROSSA]: 0 });
    expect(parseWantedHandLines("{abîmé")).toBeNull();
    expect(parseWantedHandLines(JSON.stringify({ [PASSIONE]: 6 }))).toBeNull();
    expect(parseWantedHandLines(JSON.stringify({ [MOSCAROSSA]: -6 }))).toBeNull();
    expect(parseWantedHandLines(JSON.stringify({ [MOSCAROSSA]: 2.5 }))).toBeNull();
    expect(parseWantedHandLines(JSON.stringify([6]))).toBeNull();
  });
});
