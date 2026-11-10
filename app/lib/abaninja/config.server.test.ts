import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { readAbaNinjaConfig } from "./config.server";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";

function read(env: Readonly<Record<string, string | undefined>>): ReturnType<typeof readAbaNinjaConfig> {
  return readAbaNinjaConfig(env);
}

describe("readAbaNinjaConfig", () => {
  it("accepte une configuration valide", () => {
    const result = read({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.authorizationHeader()).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it.each([
    ["jeton absent", { ABANINJA_TOKEN: undefined, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }],
    ["jeton vide", { ABANINJA_TOKEN: "  ", ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }],
    ["jeton avec espace", { ABANINJA_TOKEN: "abcdefgh ijklmnopqrst", ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }],
    ["jeton avec retour ligne au milieu", { ABANINJA_TOKEN: `${TEST_TOKEN}\nABCDEF`, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }],
    ["jeton trop court", { ABANINJA_TOKEN: "court", ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }],
    ["jeton trop long", { ABANINJA_TOKEN: "a".repeat(3000), ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID }],
    ["uuid absent", { ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: undefined }],
    ["uuid invalide", { ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: "pas-un-uuid" }],
  ])("refuse : %s", (_label, env) => {
    const result = read(env);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("non_configure");
      expect(result.error.message).not.toContain(env.ABANINJA_TOKEN ?? "\u0000");
    }
  });

  it("retire les espaces et sauts de ligne en bout de jeton et d'identifiant", () => {
    const result = read({ ABANINJA_TOKEN: `  ${TEST_TOKEN}\n`, ABANINJA_ACCOUNT_UUID: `${TEST_ACCOUNT_UUID}\r\n` });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.authorizationHeader()).toBe(`Bearer ${TEST_TOKEN}`);
      expect(result.value.accountUuid).toBe(TEST_ACCOUNT_UUID);
    }
  });

  it("donne un message précis pour chaque cas, sans jamais citer la valeur", () => {
    const messageOf = (env: Readonly<Record<string, string | undefined>>): string => {
      const result = read(env);
      return result.ok ? "" : result.error.message;
    };
    expect(messageOf({ ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID })).toContain("absent");
    const badToken = messageOf({ ABANINJA_TOKEN: "abcdefgh ijklmnopqrst", ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
    expect(badToken).toContain("caractères invalides");
    expect(badToken).not.toContain("abcdefgh");
    expect(messageOf({ ABANINJA_TOKEN: TEST_TOKEN })).toContain("identifiant de compte");
    const badUuid = messageOf({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: "mon-secret" });
    expect(badUuid).toContain("invalide");
    expect(badUuid).not.toContain("mon-secret");
  });

  it("ne révèle jamais le jeton (JSON, inspect, texte)", () => {
    const result = read({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
    if (!result.ok) throw result.error;
    expect(JSON.stringify(result.value)).not.toContain(TEST_TOKEN);
    expect(inspect(result.value)).not.toContain(TEST_TOKEN);
    expect(String(result.value)).not.toContain(TEST_TOKEN);
    expect(JSON.stringify({ ...result.value })).not.toContain(TEST_TOKEN);
  });
});
