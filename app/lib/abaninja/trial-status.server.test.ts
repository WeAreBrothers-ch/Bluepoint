import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNT_UUID, TEST_TOKEN } from "./test-support";
import { ENV, fakePrisma, NOW, rows, seedTrial, SHOP } from "./trial.test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: fakePrisma }));

const { loadTrialPageStatus } = await import("./trial-status.server");

const HOUR = 60 * 60_000;

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
});

describe("état des accès affiché par la page", () => {
  it("présent et valide, sans aucun morceau de valeur dans ce qui part au navigateur", async () => {
    const status = await loadTrialPageStatus(SHOP, ENV, NOW);
    expect(status.config).toEqual({ kind: "ok" });
    const text = JSON.stringify(status);
    expect(text).not.toContain(TEST_TOKEN);
    expect(text).not.toContain(TEST_ACCOUNT_UUID);
    expect(text).not.toContain(TEST_ACCOUNT_UUID.slice(-4));
  });

  it("absent : le message précis de la configuration", async () => {
    const status = await loadTrialPageStatus(SHOP, {}, NOW);
    expect(status.config.kind).toBe("absente");
  });

  it("invalide (présent mais refusé) : distinct de « absent », jeton jamais cité", async () => {
    const env = { ...ENV, ABANINJA_TOKEN: "SECRET-AVEC\nSAUT-DE-LIGNE-1234567890" };
    const status = await loadTrialPageStatus(SHOP, env, NOW);
    expect(status.config.kind).toBe("invalide");
    expect(JSON.stringify(status)).not.toContain("SECRET-AVEC");
  });
});

describe("dernier essai affiché par la page", () => {
  it("rappelle ce qu'il reste à supprimer à la main", async () => {
    seedTrial("creee", 2 * HOUR, { lastErrorCode: "gardee" });
    const status = await loadTrialPageStatus(SHOP, ENV, NOW);
    expect(status.lastTrial?.cleanupIssue).toBe("gardee");
  });

  it("n'invente pas de rappel pour un code d'erreur ordinaire ou un essai incertain", async () => {
    seedTrial("refusee", 2 * HOUR, { lastErrorCode: "adresse" });
    expect((await loadTrialPageStatus(SHOP, ENV, NOW)).lastTrial?.cleanupIssue).toBeNull();
    rows.clear();
    seedTrial("incertaine", 2 * HOUR, { lastErrorCode: "gardee" });
    expect((await loadTrialPageStatus(SHOP, ENV, NOW)).lastTrial?.cleanupIssue).toBeNull();
  });

  it("propose le déblocage seulement pour un essai incertain depuis plus de 30 minutes", async () => {
    seedTrial("incertaine", 2 * HOUR, { idleMs: 10 * 60_000 });
    expect((await loadTrialPageStatus(SHOP, ENV, NOW)).lastTrial?.resolve).toEqual({ kind: "attente", minutes: 20 });
    rows.clear();
    seedTrial("incertaine", 2 * HOUR, { idleMs: 31 * 60_000 });
    expect((await loadTrialPageStatus(SHOP, ENV, NOW)).lastTrial?.resolve).toEqual({ kind: "possible" });
    rows.clear();
    seedTrial("creee", 2 * HOUR);
    expect((await loadTrialPageStatus(SHOP, ENV, NOW)).lastTrial?.resolve).toEqual({ kind: "non" });
  });

  it("base illisible : on le dit", async () => {
    fakePrisma.abaNinjaInvoice.findFirst.mockRejectedValueOnce(new Error("base HS"));
    const status = await loadTrialPageStatus(SHOP, ENV, NOW);
    expect(status.historyReadable).toBe(false);
  });
});
