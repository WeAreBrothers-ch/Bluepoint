import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { entryLinks, shopEntry, type EntryLink } from "../../lib/accueil/entree-app";
import { AccueilPage } from "./AccueilPage";

/** La page d'accueil rendue côté serveur (hors de l'admin Shopify) : textes clairs, un bouton par page, aucun formulaire. */

function render(links: readonly EntryLink[] | null): string {
  return renderToString(createElement(AccueilPage, { links }));
}

function decode(html: string): string {
  return html.replaceAll("&amp;", "&").replaceAll("&#x27;", "'");
}

describe("page d'accueil publique", () => {
  const entry = shopEntry("5s71g8-0v.myshopify.com");
  if (entry === null) throw new Error("boutique de test refusée");
  const links = entryLinks(entry, "cle-publique");

  it("montre un bouton par page du menu, qui ouvre Shopify directement dessus", () => {
    const html = decode(render(links));
    for (const label of ["Livraisons", "Prendre une commande", "Factures", "Stock", "Clients"]) expect(html).toContain(label);
    expect(html).toContain('href="https://admin.shopify.com/store/5s71g8-0v/apps/cle-publique/app"');
    expect(html).toContain('href="https://admin.shopify.com/store/5s71g8-0v/apps/cle-publique/app/commande"');
    expect(html).toContain("Cette application s’utilise dans Shopify.");
    expect(html).toContain("votre compte Shopify habituel");
  });

  it("n'a plus le champ « Adresse de la boutique »", () => {
    const html = render(links);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("myshopify.com</span>");
    expect(html).not.toContain("Adresse de la boutique");
  });

  it("sans boutique connue, mène quand même à Shopify", () => {
    const html = render(null);
    expect(html).toContain('href="https://admin.shopify.com/"');
    expect(html).toContain("Ouvrir Shopify");
    expect(html).toContain("bluepoint-gestion");
  });
});
