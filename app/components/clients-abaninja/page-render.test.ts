import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { compareCards } from "../../lib/clients-abaninja/match";
import type { AbaNinjaClientsPageData } from "../../lib/clients-abaninja/page-data.server";
import { card, client, side, UUID_FAVRE, UUID_PARC } from "../../lib/clients-abaninja/test-builders";
import { toComparisonView } from "../../lib/clients-abaninja/view";

/** La page affichée en entier avec de fausses fiches : elle se construit sans erreur et montre groupes et boutons. */

vi.mock("@shopify/app-bridge-react", () => ({ useAppBridge: () => ({ toast: { show: vi.fn() } }) }));

const { AbaNinjaClientsPageView } = await import("./AbaNinjaClientsPageView");

const uuid = (index: number) => `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`;

function readyData(): AbaNinjaClientsPageData {
  const linked = { uuid: UUID_FAVRE, kind: "company" as const, number: "A9" };
  const cards = [
    card(),
    card({ uuid: UUID_PARC, name: "Hôtel du Parc", emails: ["parc@hotel.ch"], phone: null }),
    card({ uuid: UUID_FAVRE, name: "Café Favre", emails: ["favre@cafe.ch"], phone: null }),
    card({ uuid: uuid(1), number: "1062", name: "Clients privés", emails: [], phone: null }),
    card({ uuid: uuid(2), name: "Fournisseur Vins", emails: ["vente@fournisseur.ch"], phone: null }),
    ...Array.from({ length: 21 }, (_, index) => card({ uuid: uuid(index + 10), name: `Restaurant ${index}`, emails: [`r${index}@resto.ch`], phone: null })),
    card({ uuid: uuid(3), kind: "person", name: "Luc Sansmail", emails: [], phone: null }),
  ];
  const shopify = side(
    [
      client({ customerId: "gid://shopify/Customer/1", email: "info@lac.ch" }),
      client({ customerId: "gid://shopify/Customer/2", email: "parc@hotel.ch", displayName: "Hôtel du Parc SA" }),
      client({ customerId: "gid://shopify/Customer/3", email: "favre@cafe.ch", link: linked }),
    ],
    [uuid(2)],
  );
  return { state: "pret", canCreate: true, view: toComparisonView(compareCards(cards, shopify), shopify, { cards, skipped: 1, truncated: false }) };
}

function render(data: AbaNinjaClientsPageData): string {
  const Stub = createRoutesStub([{ path: "/", Component: () => createElement(AbaNinjaClientsPageView, { data }) }]);
  return renderToString(createElement(Stub, { initialEntries: ["/"] }));
}

describe("page Clients AbaNinja", () => {
  it("montre chaque groupe, ses boutons et le lot", () => {
    const html = render(readyData());
    expect(html).toContain("Même e-mail (2)");
    expect(html).toContain("Relier les 2 fiches");
    expect(html).toContain("Relier à ce client");
    expect(html).toContain("Pas encore dans la boutique (22)");
    expect(html).toContain("Créer les 21 fiches qui ont un e-mail");
    expect(html).toContain("Voir 2 fiches de plus");
    expect(html).not.toContain("Luc Sansmail");
    expect(html).not.toContain("Restaurant 20");
    expect(html).toContain("Déjà reliées (1)");
    expect(html).toContain("Terminer le compte pro");
    expect(html).toContain("Mises de côté (2)");
    expect(html).toContain("1 fiche d’AbaNinja illisible");
  });

  it("propose « Remettre » seulement pour une fiche mise de côté à la main", () => {
    const html = render(readyData());
    expect(html.match(/Remettre/g)).toHaveLength(2);
    expect(html).toContain("jamais reprise");
  });

  it("dit quoi faire quand la comparaison a échoué", () => {
    const html = render({ state: "erreur", message: "Les fiches d’AbaNinja n’ont pas pu être lues." });
    expect(html).toContain("La comparaison n’a pas pu être faite");
    expect(html).toContain("Réessayer");
  });
});
