import { describe, expect, it } from "vitest";
import { mailtoUrl } from "./mailto";

describe("mailtoUrl", () => {
  it("garde l'adresse lisible et encode l'objet et le message", () => {
    const url = mailtoUrl(" client@exemple.ch ", "Facture BP-2026-0001 — commande #1042", "Bonjour,\nTotal : CHF 12.50 & merci");
    expect(url).toBe(
      "mailto:client@exemple.ch?subject=Facture%20BP-2026-0001%20%E2%80%94%20commande%20%231042&body=Bonjour%2C%0ATotal%20%3A%20CHF%2012.50%20%26%20merci",
    );
  });

  it("ne laisse pas un & ou un ? du message couper les paramètres", () => {
    const url = mailtoUrl("a@b.ch", "x", "a&body=pirate?c");
    expect(url.split("&")).toHaveLength(2);
  });
});
