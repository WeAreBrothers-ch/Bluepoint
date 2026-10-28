import { describe, expect, it } from "vitest";
import { createShareToken, verifyShareToken } from "./share-token";

const secret = "secret-de-test";
const now = new Date("2026-10-21T10:00:00Z");

describe("lien public signé", () => {
  it("accepte un jeton valide et rend l'identifiant", () => {
    const token = createShareToken("cm123abc", secret, now);
    const check = verifyShareToken(token, secret, new Date("2026-11-03T10:00:00Z"));
    expect(check).toMatchObject({ ok: true, invoiceId: "cm123abc" });
  });

  it("expire après 14 jours", () => {
    const token = createShareToken("cm123abc", secret, now);
    expect(verifyShareToken(token, secret, new Date("2026-11-04T10:00:01Z"))).toEqual({ ok: false, reason: "expire" });
  });

  it("refuse un jeton modifié, mal formé ou signé avec un autre secret", () => {
    const token = createShareToken("cm123abc", secret, now);
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from("autre.9999999999").toString("base64url")}.${signature}`;
    expect(verifyShareToken(forged, secret, now)).toEqual({ ok: false, reason: "invalide" });
    expect(verifyShareToken(`${payload}.${signature}x`, secret, now)).toEqual({ ok: false, reason: "invalide" });
    expect(verifyShareToken(token, "autre-secret", now)).toEqual({ ok: false, reason: "invalide" });
    expect(verifyShareToken("n'importe quoi", secret, now)).toEqual({ ok: false, reason: "invalide" });
  });
});
