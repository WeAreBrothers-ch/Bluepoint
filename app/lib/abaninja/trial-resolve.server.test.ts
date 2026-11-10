import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakePrisma, NOW, rows, seedTrial, SHOP } from "./trial.test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: fakePrisma }));

const { resolveStuckTrial } = await import("./trial-resolve.server");
const { runTrialAction } = await import("./trial-actions.server");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
});

describe("débloquer un essai incertain", () => {
  it("refusé avant 30 minutes, l'essai ne bouge pas", async () => {
    const row = seedTrial("incertaine", 2 * HOUR, { idleMs: 10 * MINUTE });
    const result = await resolveStuckTrial(SHOP, row.reference, NOW);
    expect(!result.ok && result.error.message).toContain("Trop tôt");
    expect(rows.get(row.orderId)?.state).toBe("incertaine");
  });

  it("mesuré sur la dernière mise à jour, pas sur la création", async () => {
    const row = seedTrial("incertaine", 10 * HOUR, { idleMs: 5 * MINUTE });
    expect((await resolveStuckTrial(SHOP, row.reference, NOW)).ok).toBe(false);
  });

  it("accepté après 30 minutes : l'essai devient « refusee »", async () => {
    const row = seedTrial("incertaine", HOUR, { idleMs: 31 * MINUTE });
    expect((await resolveStuckTrial(SHOP, row.reference, NOW)).ok).toBe(true);
    expect(rows.get(row.orderId)?.state).toBe("refusee");
  });

  it("un essai resté « en cours » est aussi débloquable après 30 minutes", async () => {
    const row = seedTrial("en_cours", HOUR, { idleMs: 40 * MINUTE });
    expect((await resolveStuckTrial(SHOP, row.reference, NOW)).ok).toBe(true);
    expect(rows.get(row.orderId)?.state).toBe("refusee");
  });

  it("jamais pour une ligne « creee » ni « refusee », même très ancienne", async () => {
    for (const state of ["creee", "refusee"]) {
      rows.clear();
      const row = seedTrial(state, 20 * HOUR);
      expect((await resolveStuckTrial(SHOP, row.reference, NOW)).ok).toBe(false);
      expect(rows.get(row.orderId)?.state).toBe(state);
    }
  });

  it("refusé si la référence n'est plus celle du dernier essai", async () => {
    seedTrial("incertaine", 2 * HOUR);
    const result = await resolveStuckTrial(SHOP, "BP-ESSAI-20200101-000000", NOW);
    expect(!result.ok && result.error.message).toContain("Rechargez");
  });
});

describe("formulaire de la page : confirmation explicite côté serveur", () => {
  it("lancer l'essai sans le champ de confirmation : 400, rien n'est lancé", async () => {
    const outcome = await runTrialAction(SHOP, form({ intent: "essai" }), NOW);
    expect(outcome.status).toBe(400);
    expect(outcome.result.kind).toBe("erreur");
    expect(fakePrisma.abaNinjaInvoice.findFirst).not.toHaveBeenCalled();
  });

  it("une mauvaise valeur de confirmation est refusée", async () => {
    expect((await runTrialAction(SHOP, form({ intent: "essai", confirmation: "peut-être" }), NOW)).status).toBe(400);
    expect((await runTrialAction(SHOP, form({ intent: "debloquer", confirmation: "oui", reference: "BP-ESSAI-20261110-120000" }), NOW)).status).toBe(400);
  });

  it("un champ inattendu est refusé", async () => {
    expect((await runTrialAction(SHOP, form({ intent: "essai", confirmation: "oui", orderId: "x" }), NOW)).status).toBe(400);
  });

  it("débloquer sans référence valide : 400", async () => {
    const outcome = await runTrialAction(SHOP, form({ intent: "debloquer", confirmation: "absente", reference: "n'importe quoi" }), NOW);
    expect(outcome.status).toBe(400);
  });

  it("débloquer avec confirmation : accepté après 30 minutes, refusé avant", async () => {
    const row = seedTrial("incertaine", HOUR, { idleMs: 10 * MINUTE });
    const fields = { intent: "debloquer", confirmation: "absente", reference: row.reference };
    expect((await runTrialAction(SHOP, form(fields), NOW)).status).toBe(409);
    row.updatedAt = new Date(NOW.getTime() - 31 * MINUTE);
    const done = await runTrialAction(SHOP, form(fields), NOW);
    expect(done.status).toBe(200);
    expect(done.result.kind).toBe("debloque");
    expect(rows.get(row.orderId)?.state).toBe("refusee");
  });
});
