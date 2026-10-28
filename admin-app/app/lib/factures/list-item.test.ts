import { describe, expect, it } from "vitest";
import { isFacturesIntent, readSentVia, sentStatus } from "./list-item";

describe("statut d'envoi d'une facture", () => {
  it("signale une facture jamais envoyée", () => {
    expect(sentStatus({ sentAt: null, sentTo: null, sentVia: null })).toEqual({ label: "Pas encore envoyée", tone: "neutral" });
  });

  it("indique le canal, le destinataire et la date à l'heure suisse", () => {
    const status = sentStatus({ sentAt: "2026-10-21T12:05:00Z", sentTo: "a@b.ch", sentVia: "email" });
    expect(status.tone).toBe("success");
    expect(status.label).toMatch(/^Envoyée par e-mail à a@b\.ch, le 21\.10\.2026/);
    expect(status.label).toContain("14:05");
    expect(sentStatus({ sentAt: "2026-10-21T12:05:00Z", sentTo: "+41796063322", sentVia: "whatsapp" }).label).toContain("WhatsApp");
  });

  it("valide les canaux et intentions connus", () => {
    expect(readSentVia("fax")).toBeNull();
    expect(isFacturesIntent("email")).toBe(true);
    expect(isFacturesIntent("supprimer")).toBe(false);
  });
});
