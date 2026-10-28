import { describe, expect, it } from "vitest";
import { d, task } from "./fixtures";
import { groupToday, groupWeek } from "./grouping";

const today = d("2026-10-21");
const week = { start: d("2026-10-19"), end: d("2026-10-25") };

const tasks = [
  task({ name: "#A", deadline: d("2026-10-21") }),
  task({ name: "#B", deadline: d("2026-10-15") }),
  task({ name: "#C", requestedDate: d("2026-10-23") }),
  task({ name: "#D", dateSource: "aucune" }),
  task({ name: "#E", requestedDate: d("2026-10-21"), status: "livree" }),
  task({ name: "#F", requestedDate: d("2026-10-25"), deadline: d("2026-10-30") }),
];

describe("groupToday", () => {
  it("met les retards d'abord, puis le jour même", () => {
    const groups = groupToday(tasks, today);
    expect(groups.due.map((t) => [t.name, t.urgency])).toEqual([
      ["#B", "en_retard"],
      ["#A", "aujourdhui"],
    ]);
    expect(groups.undated.map((t) => t.name)).toEqual(["#D"]);
    expect(groups.doneToday.map((t) => t.name)).toEqual(["#E"]);
  });
});

describe("groupWeek", () => {
  it("répartit les tâches du lundi au dimanche", () => {
    const groups = groupWeek(tasks, week, today);
    expect(groups.columns.map((c) => c.date)).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
    const byDate = Object.fromEntries(groups.columns.map((c) => [c.date, c.tasks.map((t) => t.name)]));
    expect(byDate["2026-10-21"]).toEqual(["#A", "#E"]);
    expect(byDate["2026-10-23"]).toEqual(["#C"]);
    expect(byDate["2026-10-25"]).toEqual(["#F"]);
    expect(groups.columns[2]?.isToday).toBe(true);
    expect(groups.columns[0]?.isPast).toBe(true);
    expect(groups.columns[0]?.weekday).toBe("lun.");
  });

  it("garde visibles les retards d'avant la semaine et les commandes sans date", () => {
    const groups = groupWeek(tasks, week, today);
    expect(groups.overdueBefore.map((t) => t.name)).toEqual(["#B"]);
    expect(groups.undated.map((t) => t.name)).toEqual(["#D"]);
  });
});
