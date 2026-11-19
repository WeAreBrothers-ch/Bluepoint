import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HandWrittenWines } from "./HandWrittenWines";

/** #1038 : le Moscarossa écrit à la main dans Shopify se change comme un vin du catalogue. */

const MOSCAROSSA = { lineItemId: "gid://shopify/LineItem/2", name: "Moscarossa 2023 — Corte Moschina", unitCents: 1600 };

function shown(bottles: number): string {
  return renderToStaticMarkup(createElement(HandWrittenWines, { wines: [MOSCAROSSA], quantities: { [MOSCAROSSA.lineItemId]: bottles }, onSet: () => undefined }));
}

describe("vins écrits à la main dans « Modifier les vins »", () => {
  it("2 cartons : « retirer un carton », le nombre de cartons, « ajouter », la corbeille, et le prix de la commande", () => {
    const html = shown(12);
    expect(html).toContain(`Retirer un carton de ${MOSCAROSSA.name}`);
    expect(html).toContain(`Ajouter un carton de ${MOSCAROSSA.name}`);
    expect(html).toContain(`Retirer ${MOSCAROSSA.name} de la commande`);
    expect(html).toContain("cartons");
    expect(html).toContain("la bouteille (prix de la commande)");
  });

  it("retiré (zéro) : un seul bouton pour le remettre", () => {
    const html = shown(0);
    expect(html).toContain("Ajouter un carton de 6");
    expect(html).not.toContain(`Retirer un carton de ${MOSCAROSSA.name}`);
  });
});
