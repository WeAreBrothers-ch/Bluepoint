import { describe, expect, it } from "vitest";
import { buildRequestPath, maskPath } from "./path";
import { OTHER_UUID } from "./test-support";

describe("buildRequestPath", () => {
  it("assemble des segments sûrs et un uuid valide", () => {
    const result = buildRequestPath(["invoices", { uuid: OTHER_UUID }, "download"], { page: 2 });
    expect(result).toEqual({ ok: true, value: `/invoices/${OTHER_UUID}/download?page=2` });
  });

  it.each(["../secret", "..", "?x=1", "a/b", "a#b", "", "http://evil.test", "a@b"])(
    "refuse le segment littéral %j",
    (segment) => {
      expect(buildRequestPath(["invoices", segment]).ok).toBe(false);
    },
  );

  it.each(["../../etc", `${OTHER_UUID}?x=`, `${OTHER_UUID}/..`, "123", ""])("refuse l'uuid %j", (uuid) => {
    const result = buildRequestPath(["invoices", { uuid }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("donnees_refusees");
  });

  it("refuse un chemin vide", () => {
    expect(buildRequestPath([]).ok).toBe(false);
  });

  it("encode les paramètres de requête", () => {
    const result = buildRequestPath(["clients"], { q: "a&b=c" });
    expect(result).toEqual({ ok: true, value: "/clients?q=a%26b%3Dc" });
  });
});

describe("maskPath", () => {
  it("masque les uuid et retire la requête", () => {
    expect(maskPath(`/invoices/${OTHER_UUID}?q=secret`)).toBe("/invoices/:uuid");
  });
});
