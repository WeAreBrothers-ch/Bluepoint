import { describe, expect, it } from "vitest";
import { cannotDeleteMessage, companyCleanup, deletedMessage } from "./delete";

describe("supprimer un client", () => {
  it("efface l'entreprise pro seulement si elle ne sert qu'à ce client", () => {
    expect(companyCleanup({ contactId: "c", companyId: "e", orders: 0, contacts: 1 })).toBe("entreprise");
    expect(companyCleanup({ contactId: "c", companyId: "e", orders: 2, contacts: 1 })).toBe("contact");
    expect(companyCleanup({ contactId: "c", companyId: "e", orders: 0, contacts: 3 })).toBe("contact");
  });

  it("explique pourquoi un client qui a commandé ne s'efface pas", () => {
    expect(cannotDeleteMessage(1)).toContain("1 commande :");
    expect(cannotDeleteMessage(3)).toContain("3 commandes");
    expect(deletedMessage("Dupont SA")).toBe("« Dupont SA » a été supprimé.");
  });
});
