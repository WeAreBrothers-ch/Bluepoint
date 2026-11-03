import { afterEach, describe, expect, it, vi } from "vitest";
import { emailConfig, isEmailConfigured, sendInvoiceEmail } from "./email.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("réglages d'envoi par e-mail (Infomaniak)", () => {
  it("n'est pas configuré sans boîte ni mot de passe", () => {
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    expect(isEmailConfigured()).toBe(false);
  });

  it("utilise le serveur Infomaniak chiffré et le nom BluePoint par défaut", () => {
    vi.stubEnv("SMTP_USER", " factures@bluepointdistribution.com ");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_PORT", "");
    vi.stubEnv("EMAIL_FROM_NAME", "");
    expect(emailConfig()).toEqual({
      host: "mail.infomaniak.com",
      port: 465,
      user: "factures@bluepointdistribution.com",
      password: "mot-de-passe",
      fromName: "Blue Point Distribution",
    });
  });

  it("ignore un port illisible", () => {
    vi.stubEnv("SMTP_USER", "factures@bluepointdistribution.com");
    vi.stubEnv("SMTP_PASSWORD", "mot-de-passe");
    vi.stubEnv("SMTP_PORT", "abc");
    expect(emailConfig()?.port).toBe(465);
  });

  it("refuse l'envoi tant que rien n'est configuré", async () => {
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    const result = await sendInvoiceEmail({
      to: "client@example.ch",
      replyTo: "info@bluepointdistribution.com",
      subject: "Facture",
      text: "Bonjour",
      fileName: "facture.pdf",
      pdf: new Uint8Array([1, 2, 3]),
    });
    expect(result.ok).toBe(false);
  });
});
