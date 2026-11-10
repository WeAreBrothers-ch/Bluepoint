import { describe, expect, it } from "vitest";
import { checkDownloadUrl } from "./pdf-url";

describe("checkDownloadUrl", () => {
  it("accepte api.abaninja.ch et envoie le jeton", () => {
    const result = checkDownloadUrl("https://api.abaninja.ch/files/abc?sig=1");
    expect(result.ok && result.value.sendAuthorization).toBe(true);
  });

  it("accepte un sous-domaine abaninja.ch mais SANS envoyer le jeton", () => {
    const result = checkDownloadUrl("https://files.abaninja.ch/x.pdf");
    expect(result.ok && result.value.sendAuthorization).toBe(false);
  });

  it.each([
    ["http", "http://api.abaninja.ch/x"],
    ["autre domaine", "https://example.com/x.pdf"],
    ["suffixe piégé", "https://api.abaninja.ch.evil.com/x"],
    ["chemin piégé", "https://evil.com/.abaninja.ch"],
    ["requête piégée", "https://evil.com/?a=.abaninja.ch"],
    ["domaine collé", "https://evilabaninja.ch/x"],
    ["domaine nu", "https://abaninja.ch/x"],
    ["point final", "https://api.abaninja.ch./x"],
    ["identifiants", "https://user:pass@api.abaninja.ch/x"],
    ["identifiant seul", "https://api.abaninja.ch@evil.com/x"],
    ["antislash", "https://evil.com\\@api.abaninja.ch/x"],
    ["port", "https://api.abaninja.ch:8443/x"],
    ["adresse IPv4", "https://127.0.0.1/x"],
    ["adresse IPv4 décimale", "https://2130706433/x"],
    ["adresse IPv6", "https://[::1]/x"],
    ["localhost", "https://localhost/x"],
    ["schéma file", "file:///etc/passwd"],
    ["schéma data", "data:application/pdf;base64,AAAA"],
    ["retour à la ligne", "https://api.abaninja.ch/x\nHost: evil.com"],
    ["espace", "https://api.abaninja.ch /x"],
    ["vide", ""],
    ["illisible", "pas une adresse"],
    ["trop longue", `https://api.abaninja.ch/${"a".repeat(2100)}`],
  ])("refuse : %s", (_label, raw) => {
    const result = checkDownloadUrl(raw);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain("refusé par sécurité");
  });
});

describe("checkDownloadUrl : message pour ajuster la liste blanche", () => {
  it("cite l'hôte refusé (hôte seulement, pas le chemin)", () => {
    const result = checkDownloadUrl("https://cdn.exemple-stockage.test/secret/path.pdf?sig=abc");
    expect(!result.ok && result.error.message).toContain("cdn.exemple-stockage.test");
    expect(!result.ok && result.error.message).not.toContain("secret");
    expect(!result.ok && result.error.message).not.toContain("sig=abc");
  });
});
