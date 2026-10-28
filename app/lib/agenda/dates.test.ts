import { describe, expect, it } from "vitest";
import { addDays, capitalize, daysBetween, daysOfWeek, longDay, rangeForView, swissIsoDate, weekContaining, weekFromParam } from "./dates";
import { d } from "./fixtures";

describe("dates de l'agenda (heure suisse)", () => {
  it("prend le jour suisse, pas le jour UTC", () => {
    // 23 h 30 UTC le 20 octobre = 01 h 30 le 21 octobre à Zurich (heure d'été).
    expect(swissIsoDate(new Date("2026-10-20T23:30:00Z"))).toBe("2026-10-21");
    // En hiver (UTC+1) : 23 h 30 UTC le 31 décembre = 00 h 30 le 1er janvier.
    expect(swissIsoDate(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("ajoute des jours sans décalage au passage à l'heure d'hiver", () => {
    expect(addDays(d("2026-10-24"), 1)).toBe("2026-10-25");
    expect(addDays(d("2026-10-25"), 1)).toBe("2026-10-26");
    expect(addDays(d("2026-03-01"), -1)).toBe("2026-02-28");
  });

  it("compte les jours entre deux dates", () => {
    expect(daysBetween(d("2026-10-21"), d("2026-10-23"))).toBe(2);
    expect(daysBetween(d("2026-10-21"), d("2026-10-20"))).toBe(-1);
    expect(daysBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2);
  });

  it("construit la semaine du lundi au dimanche", () => {
    expect(weekContaining(d("2026-10-21"))).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(weekContaining(d("2026-10-25"))).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(weekContaining(d("2026-10-19"))).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(daysOfWeek({ start: d("2026-10-19"), end: d("2026-10-25") })).toHaveLength(7);
  });

  it("calcule la vue du jour à l'heure suisse", () => {
    const now = new Date("2026-10-25T23:30:00Z"); // lundi 26 à 00 h 30 en Suisse (heure d’hiver, UTC+1)
    expect(rangeForView("aujourdhui", now)).toEqual({ start: "2026-10-26", end: "2026-10-26" });
    expect(rangeForView("semaine", now)).toEqual({ start: "2026-10-26", end: "2026-11-01" });
  });

  it("écrit les jours en toutes lettres", () => {
    expect(longDay(d("2026-10-29"))).toBe("jeudi 29 octobre");
    expect(capitalize(longDay(d("2026-11-01")))).toBe("Dimanche 1 novembre");
  });

  it("choisit la semaine demandée, sinon celle du jour", () => {
    expect(weekFromParam("2026-11-04", d("2026-10-28"))).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(weekFromParam(null, d("2026-10-28"))).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(weekFromParam("n'importe quoi", d("2026-10-28"))).toEqual({ start: "2026-10-26", end: "2026-11-01" });
  });
});
