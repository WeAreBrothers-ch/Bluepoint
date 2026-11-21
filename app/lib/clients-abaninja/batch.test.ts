import { describe, expect, it } from "vitest";
import { batchMessage, runBatch } from "./batch";

const names = (n: number) => Array.from({ length: n }, (_, index) => `Fiche ${index + 1}`);

describe("runBatch", () => {
  it("s'arrête à 15 fiches et dit combien il en reste", async () => {
    const report = await runBatch(names(20), (name) => name, async () => ({ ok: true, message: "" }));
    expect(report).toEqual({ done: 15, failures: [], remaining: 5 });
  });

  it("s'arrête quand les 45 secondes sont passées", async () => {
    let clock = 0;
    const report = await runBatch(
      names(5),
      (name) => name,
      async () => {
        clock += 20_000;
        return { ok: true, message: "" };
      },
      () => clock,
    );
    expect(report).toEqual({ done: 3, failures: [], remaining: 2 });
  });

  it("continue après un échec et le garde", async () => {
    const report = await runBatch(names(3), (name) => name, async (name) => ({ ok: name !== "Fiche 2", message: "refusé" }));
    expect(report).toEqual({ done: 2, failures: [{ name: "Fiche 2", message: "refusé" }], remaining: 0 });
  });
});

describe("batchMessage", () => {
  it("dit ce qui est fait, ce qui a échoué et ce qui reste", () => {
    expect(batchMessage({ done: 12, failures: [{ name: "Hôtel du Parc", message: "refusé" }], remaining: 30 }, "reliée")).toBe(
      "12 fiches reliées. 1 n’a pas marché (Hôtel du Parc\u202F: refusé). Encore 30\u202F: touchez à nouveau le bouton.",
    );
  });

  it("accorde au singulier", () => {
    expect(batchMessage({ done: 1, failures: [], remaining: 0 }, "créée")).toBe("1 fiche créée.");
    expect(batchMessage({ done: 0, failures: [], remaining: 0 }, "créée")).toBe("0 fiche créée.");
  });
});
