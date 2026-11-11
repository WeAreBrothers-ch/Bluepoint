import { describe, expect, it } from "vitest";
import { backLink, orderHref } from "./navigation";

describe("retour depuis une fiche commande", () => {
  it("ramène à la page d'où l'on vient, avec le nom du menu", () => {
    expect(backLink("factures")).toEqual({ href: "/app/factures", label: "Retour aux factures" });
    expect(backLink("commandes")).toEqual({ href: "/app/commandes", label: "Retour à la liste des commandes" });
    expect(backLink("livraisons")).toEqual({ href: "/app", label: "Retour aux livraisons" });
    expect(backLink(null)).toEqual({ href: "/app", label: "Retour aux livraisons" });
    expect(backLink("n'importe quoi")).toEqual({ href: "/app", label: "Retour aux livraisons" });
    expect(orderHref("42", "factures")).toBe("/app/commandes/42?depuis=factures");
    expect(orderHref("42", "client", "7")).toBe("/app/commandes/42?depuis=client&client=7");
    expect(backLink("client", "7")).toEqual({ href: "/app/clients/7", label: "Retour à la fiche du client" });
    expect(backLink("client", "../x")).toEqual({ href: "/app", label: "Retour aux livraisons" });
  });
});
