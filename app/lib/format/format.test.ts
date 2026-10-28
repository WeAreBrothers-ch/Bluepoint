import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { formatAmount, formatChf } from "./money";
import { formatShortSwissDate, formatSwissDate } from "./dates";
import { withColon } from "./typography";

describe("formatChf", () => {
  it("sépare les milliers par une apostrophe typographique", () => {
    expect(formatAmount(144000)).toBe("1’440.00");
    expect(formatAmount(123456789)).toBe("1’234’567.89");
    expect(formatChf(2450)).toBe("CHF 24.50");
  });

  it("affiche les montants négatifs avec un vrai signe moins", () => {
    expect(formatAmount(-5000)).toBe("−50.00");
  });

  it("refuse un montant qui n'est pas un entier", () => {
    expect(() => formatAmount(10.5)).toThrow(RangeError);
  });
});

describe("dates suisses", () => {
  it("formate jj.mm.aaaa sans décalage de fuseau", () => {
    expect(formatSwissDate("2026-01-01" as IsoDate)).toBe("01.01.2026");
    expect(formatShortSwissDate("2026-12-31" as IsoDate)).toBe("31.12");
  });
});

describe("typographie", () => {
  it("met une espace fine insécable avant les deux-points", () => {
    expect(withColon("Échéance")).toBe("Échéance :");
  });
});
