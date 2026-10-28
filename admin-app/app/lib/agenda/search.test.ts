import { describe, expect, it } from "vitest";
import { d } from "./fixtures";
import { fulfilledOrdersSearch, openOrdersSearch } from "./search";

describe("filtres de recherche des commandes", () => {
  it("exclut les commandes annulées et déjà expédiées", () => {
    expect(openOrdersSearch()).toBe("status:open AND -status:cancelled AND -fulfillment_status:fulfilled");
  });

  it("cherche les commandes expédiées depuis deux semaines avant la semaine affichée", () => {
    expect(fulfilledOrdersSearch({ start: d("2026-10-19"), end: d("2026-10-25") })).toBe(
      "fulfillment_status:fulfilled AND -status:cancelled AND updated_at:>='2026-10-05T00:00:00Z'",
    );
  });
});
