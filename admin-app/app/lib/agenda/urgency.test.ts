import { describe, expect, it } from "vitest";
import { d, task } from "./fixtures";
import { compareTasks, computeUrgency, scheduleTask } from "./urgency";

const today = d("2026-10-21");

describe("computeUrgency", () => {
  it("classe selon la date prévue et la date limite", () => {
    expect(computeUrgency(d("2026-10-20"), d("2026-10-20"), today)).toBe("en_retard");
    expect(computeUrgency(d("2026-10-21"), d("2026-10-21"), today)).toBe("aujourdhui");
    expect(computeUrgency(d("2026-10-22"), d("2026-10-25"), today)).toBe("bientot");
    expect(computeUrgency(d("2026-10-23"), d("2026-10-23"), today)).toBe("bientot");
    expect(computeUrgency(d("2026-10-24"), d("2026-10-24"), today)).toBe("planifiee");
    expect(computeUrgency(null, null, today)).toBe("sans_date");
  });

  it("garde une livraison souhaitée hier mais pas encore limite comme « aujourd’hui »", () => {
    expect(computeUrgency(d("2026-10-20"), d("2026-10-23"), today)).toBe("aujourdhui");
  });
});

describe("scheduleTask", () => {
  it("utilise la date limite quand la date souhaitée manque, et inversement", () => {
    expect(scheduleTask(task({ deadline: d("2026-10-22") }), today)).toMatchObject({
      plannedDate: "2026-10-22",
      limitDate: "2026-10-22",
      urgency: "bientot",
    });
    expect(scheduleTask(task({ requestedDate: d("2026-10-19") }), today).urgency).toBe("en_retard");
  });
});

describe("compareTasks", () => {
  it("met les retards en tête et les livrées en fin", () => {
    const late = scheduleTask(task({ name: "#3", deadline: d("2026-10-18") }), today);
    const now = scheduleTask(task({ name: "#1", deadline: d("2026-10-21") }), today);
    const done = scheduleTask(task({ name: "#0", deadline: d("2026-10-17"), status: "livree" }), today);
    expect([done, now, late].sort(compareTasks).map((t) => t.name)).toEqual(["#3", "#1", "#0"]);
  });

  it("trie les numéros de commande dans l'ordre naturel", () => {
    const a = scheduleTask(task({ name: "#1010", deadline: today }), today);
    const b = scheduleTask(task({ name: "#999", deadline: today }), today);
    expect([a, b].sort(compareTasks).map((t) => t.name)).toEqual(["#999", "#1010"]);
  });
});
