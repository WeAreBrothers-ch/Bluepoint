import { describe, expect, it } from "vitest";
import { findAttribute, parseLooseDate } from "./attributes";

describe("attributs de panier", () => {
  it("lit les dates ISO et suisses", () => {
    expect(parseLooseDate("2026-10-21")).toBe("2026-10-21");
    expect(parseLooseDate(" 21.10.2026 ")).toBe("2026-10-21");
    expect(parseLooseDate("1.2.2026")).toBe("2026-02-01");
  });

  it("ignore les dates impossibles ou illisibles", () => {
    expect(parseLooseDate("31.02.2026")).toBeNull();
    expect(parseLooseDate("demain")).toBeNull();
    expect(parseLooseDate(null)).toBeNull();
  });

  it("retrouve un attribut malgré la casse et l'apostrophe", () => {
    const attributes = [{ key: "date de livraison souhaitée ", value: "2026-10-22" }];
    expect(findAttribute(attributes, "Date de livraison souhaitée")).toBe("2026-10-22");
    expect(findAttribute(attributes, "Livrer au plus tard")).toBeNull();
  });
});
