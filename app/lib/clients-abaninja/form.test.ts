import { describe, expect, it } from "vitest";
import { parseAbaNinjaClientsForm } from "./form";

const UUID = "11111111-1111-4111-8111-111111111111";

function form(values: Record<string, string>): URLSearchParams {
  return new URLSearchParams(values);
}

describe("parseAbaNinjaClientsForm", () => {
  it("lit « relier » et « pas_lui » avec la fiche et le client", () => {
    expect(parseAbaNinjaClientsForm(form({ intent: "relier", fiche: UUID.toUpperCase(), client: "gid://shopify/Customer/42" }))).toEqual({
      intent: "relier",
      fiche: UUID,
      client: "gid://shopify/Customer/42",
    });
    expect(parseAbaNinjaClientsForm(form({ intent: "pas_lui", fiche: UUID, client: "gid://shopify/Customer/42" }))?.intent).toBe("pas_lui");
  });

  it("lit les actions sur une fiche seule et les lots", () => {
    expect(parseAbaNinjaClientsForm(form({ intent: "creer", fiche: UUID }))).toEqual({ intent: "creer", fiche: UUID });
    expect(parseAbaNinjaClientsForm(form({ intent: "remettre", fiche: UUID }))).toEqual({ intent: "remettre", fiche: UUID });
    expect(parseAbaNinjaClientsForm(form({ intent: "creer_tous" }))).toEqual({ intent: "creer_tous" });
  });

  it("refuse une fiche, un client ou une intention invalides", () => {
    expect(parseAbaNinjaClientsForm(form({ intent: "creer", fiche: "../../x" }))).toBeNull();
    expect(parseAbaNinjaClientsForm(form({ intent: "relier", fiche: UUID, client: "gid://shopify/Order/42" }))).toBeNull();
    expect(parseAbaNinjaClientsForm(form({ intent: "relier", fiche: UUID }))).toBeNull();
    expect(parseAbaNinjaClientsForm(form({ intent: "supprimer", fiche: UUID }))).toBeNull();
  });
});
