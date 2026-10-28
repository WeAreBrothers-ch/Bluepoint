import { describe, expect, it } from "vitest";
import { plainInvoiceProblems } from "./plain-problems";

describe("plainInvoiceProblems", () => {
  it("explique la TVA manquante sans nom de champ technique", () => {
    const [message] = plainInvoiceProblems(["vatLines : Au moins une ligne de TVA (taux et montant fournis par Shopify) est requise."]);
    expect(message).toContain("TVA");
    expect(message).toContain("Taxes et droits de douane");
    expect(message).not.toContain("vatLines");
  });

  it("regroupe les champs d'adresse manquants en une seule phrase", () => {
    const messages = plainInvoiceProblems(["buyer.postalCode : trop court", "buyer.city : requis"]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("adresse du client");
  });

  it("reconnaît l'adresse sans numéro de rue et la QR-facture refusée", () => {
    const messages = plainInvoiceProblems([
      "Adresse de facturation sans numéro de rue : « Quai Fictif ».",
      "QR-facture refusée : Invalid IBAN",
    ]);
    expect(messages).toHaveLength(2);
    expect(messages.join(" ")).not.toMatch(/Invalid|QR-facture refusée/);
  });

  it("garde une phrase générique pour l'inconnu", () => {
    expect(plainInvoiceProblems(["quelque chose d'imprévu"])).toEqual(["Un détail de la commande empêche de faire la facture."]);
  });
});
