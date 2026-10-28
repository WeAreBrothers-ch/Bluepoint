import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { checkNewDay, rescheduledMessage, rescheduleMetafields } from "./reschedule";

const today = "2026-10-28" as IsoDate;
const day = (value: string) => value as IsoDate;

describe("choisir le jour d'une commande", () => {
  it("accepte aujourd'hui et les jours qui viennent", () => {
    expect(checkNewDay("2026-10-28", today)).toEqual({ ok: true, date: "2026-10-28" });
    expect(checkNewDay("2026-11-02", today)).toEqual({ ok: true, date: "2026-11-02" });
  });

  it("refuse un jour passé ou illisible", () => {
    expect(checkNewDay("2026-10-27", today).ok).toBe(false);
    expect(checkNewDay("", today).ok).toBe(false);
    expect(checkNewDay(null, today).ok).toBe(false);
  });

  it("écrit le jour choisi, sans date limite s'il n'y en avait pas", () => {
    expect(rescheduleMetafields(day("2026-10-30"), null).map((field) => [field.key, field.value])).toEqual([
      ["livraison_date_souhaitee", "2026-10-30"],
    ]);
  });

  it("garde la date limite, repoussée au jour choisi si elle tombait avant", () => {
    const kept = rescheduleMetafields(day("2026-10-30"), day("2026-11-05"));
    expect(kept.map((field) => field.value)).toEqual(["2026-10-30", "2026-11-05"]);
    const pushed = rescheduleMetafields(day("2026-10-30"), day("2026-10-29"));
    expect(pushed.map((field) => field.value)).toEqual(["2026-10-30", "2026-10-30"]);
  });

  it("confirme le jour en toutes lettres", () => {
    expect(rescheduledMessage(today, today)).toBe("C’est noté\u202F: prévue aujourd’hui.");
    expect(rescheduledMessage(day("2026-10-29"), today)).toBe("C’est noté\u202F: prévue demain (jeudi 29 octobre).");
    expect(rescheduledMessage(day("2026-11-02"), today)).toBe("C’est noté\u202F: prévue le lundi 2 novembre.");
  });
});
