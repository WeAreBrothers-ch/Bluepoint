import { describe, expect, it } from "vitest";
import { isFacturesIntent, isFacturesView, preferredChannel, readSentVia, sentLabel } from "./list-item";

describe("envoi d'une facture", () => {
  it("ne dit rien d'une facture jamais envoyée", () => {
    expect(sentLabel(null, null)).toBeNull();
  });

  it("donne le canal et le jour suisse en toutes lettres", () => {
    expect(sentLabel(new Date("2026-10-21T12:05:00Z"), "email")).toBe("Envoyée par e-mail le mercredi 21 octobre");
    expect(sentLabel(new Date("2026-10-29T08:00:00Z"), "whatsapp")).toBe("Envoyée par WhatsApp le jeudi 29 octobre");
    // 22 h 30 UTC le mercredi = 0 h 30 le jeudi en Suisse : c'est le jour suisse qui compte.
    expect(sentLabel(new Date("2026-10-21T22:30:00Z"), "email")).toBe("Envoyée par e-mail le jeudi 22 octobre");
  });

  it("propose d'abord le canal déjà utilisé, sinon WhatsApp si possible", () => {
    expect(preferredChannel("email", "whatsapp", true)).toBe("email");
    expect(preferredChannel(null, "email", true)).toBe("email");
    expect(preferredChannel(null, null, true)).toBe("whatsapp");
    expect(preferredChannel(null, null, false)).toBe("email");
  });

  it("valide les canaux, intentions et onglets connus", () => {
    expect(readSentVia("fax")).toBeNull();
    expect(readSentVia("whatsapp")).toBe("whatsapp");
    expect(isFacturesIntent("email")).toBe(true);
    expect(isFacturesIntent("relance_email")).toBe(true);
    expect(isFacturesIntent("payee")).toBe(true);
    expect(isFacturesIntent("supprimer")).toBe(false);
    expect(isFacturesView("payees")).toBe(true);
    expect(isFacturesView("archives")).toBe(false);
  });
});
