import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAbaNinjaConfig } from "./config.server";
import { emptyResponse, jsonResponse } from "./test-support";
import { frenchTypography } from "./trial-typography";
import {
  BANK_WITHOUT_QR, COMPANY_WITHOUT_ADDRESS, ENV, expectNoSecret, expireOnCall, fakePrisma, happyScript, makeRunner, methodsOf, NOW,
  reportOf, rows, withStep,
} from "./trial.test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: fakePrisma }));

const { runConnectionTrial } = await import("./trial.server");
const run = makeRunner(runConnectionTrial);

/** Le message précis que doit montrer l'essai : celui de la configuration elle-même. */
function configMessage(env: Record<string, string | undefined>): string {
  const config = readAbaNinjaConfig(env);
  if (config.ok) throw new Error("La configuration de test devrait être refusée");
  return frenchTypography(config.error.message);
}

function outcomes(report: ReturnType<typeof reportOf>): string[] {
  return report.steps.map((step) => step.outcome);
}

beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
});

describe("arrêts avant toute création", () => {
  it("configuration absente : aucun appel réseau, message précis, aucun secret", async () => {
    const { result, calls } = await run(happyScript(), { env: {} });
    const report = reportOf(result);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
    expect(report.steps[0]?.outcome).toBe("echec");
    expect(report.steps[0]?.message).toContain(configMessage({}));
    expect(outcomes(report).slice(1)).toEqual(Array(6).fill("non_teste"));
    expectNoSecret(report);
  });

  it("jeton avec un saut de ligne : message précis de la configuration, sans jamais citer le jeton", async () => {
    const env = { ...ENV, ABANINJA_TOKEN: "SECRET-TOKEN-AVEC\nSAUT-DE-LIGNE-123456" };
    const { result, calls } = await run(happyScript(), { env });
    const report = reportOf(result);
    expect(calls).toHaveLength(0);
    expect(report.steps[0]?.message).toContain(configMessage(env));
    expect(JSON.stringify(report)).not.toContain("SECRET-TOKEN");
  });

  it("aucun compte QR : explique comment l'activer et s'arrête", async () => {
    const { result, calls } = await run([jsonResponse(BANK_WITHOUT_QR)]);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
    expect(reportOf(result).steps[1]?.message).toContain("QR-IBAN");
    expect(rows.size).toBe(0);
  });
});

describe("refus ou incertitude à la création de la facture", () => {
  it("refus net (400) : le client fictif est effacé, verrou « refusee »", async () => {
    const { result, calls } = await run([...withStep(2, emptyResponse(400), false), emptyResponse(204)]);
    const report = reportOf(result);
    expect(methodsOf(calls)).toEqual(["GET", "POST", "POST", "DELETE"]);
    expect([...rows.values()][0]?.state).toBe("refusee");
    expect(report.steps[3]?.message).not.toContain("incertain");
    expect(report.steps[6]?.outcome).toBe("ok");
  });

  it("résultat incertain (500) : jamais de rejeu ni de nettoyage, vérification demandée", async () => {
    const { result, calls } = await run(withStep(2, emptyResponse(500), false));
    const report = reportOf(result);
    expect(methodsOf(calls)).toEqual(["GET", "POST", "POST"]);
    expect([...rows.values()][0]?.state).toBe("incertaine");
    expect(report.steps[3]?.message).toContain("Vérifiez dans AbaNinja");
    expect(report.manualCleanup.join(" ")).toContain("BP-ESSAI-20261110-120000");
    expect(report.steps[6]?.outcome).toBe("non_teste");
  });

  it("après un essai incertain, un nouvel essai est refusé sans appel réseau", async () => {
    await run(withStep(2, emptyResponse(500), false));
    const later = new Date(NOW.getTime() + 10 * 60_000);
    const { result, calls } = await run(happyScript(), { now: () => later });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("refus ou incertitude à la création du client", () => {
  it("client pris pour un doublon (409) : demande de chercher et supprimer un client d'essai, verrou « refusee »", async () => {
    const { result } = await run(withStep(1, emptyResponse(409), false));
    expect(reportOf(result).steps[3]?.message).toContain("pris le client d’essai pour un doublon");
    expect([...rows.values()][0]?.state).toBe("refusee");
  });

  it("délai dépassé à l'étape client : verrou « incertaine », client à chercher, rien supprimé", async () => {
    const { result, calls } = await run([...happyScript().slice(0, 1), new Error("délai")]);
    const report = reportOf(result);
    expect(methodsOf(calls)).toEqual(["GET", "POST"]);
    expect([...rows.values()][0]).toMatchObject({ state: "incertaine", lastErrorCode: "client_incertain" });
    expect(report.manualCleanup.join(" ")).toContain("Client essai BluePoint");
    expect(report.steps[6]?.outcome).toBe("non_teste");
  });

  it("client créé sans adresse postale exploitable : même traitement, verrou « incertaine »", async () => {
    const { result, calls } = await run(withStep(1, COMPANY_WITHOUT_ADDRESS, false));
    expect(methodsOf(calls)).toEqual(["GET", "POST"]);
    expect([...rows.values()][0]?.state).toBe("incertaine");
    expect(reportOf(result).manualCleanup.join(" ")).toContain("Client essai BluePoint");
  });
});

describe("échéance globale", () => {
  it("pendant la création de la facture : « incertaine », rapport complet avec quoi chercher", async () => {
    const controller = new AbortController();
    const { result, calls } = await run(happyScript(), {
      signal: controller.signal,
      fetchWrap: (fetchImpl) => expireOnCall(3, controller, fetchImpl),
    });
    const report = reportOf(result);
    expect(calls).toHaveLength(2);
    expect([...rows.values()][0]?.state).toBe("incertaine");
    expect(report.headline).toContain("temps prévu");
    expect(report.manualCleanup.join(" ")).toContain("BP-ESSAI-20261110-120000");
  });

  it("pendant la vérification du PDF : nettoyage non tenté, consignes données et mémorisées", async () => {
    const controller = new AbortController();
    const { result } = await run(happyScript(), {
      signal: controller.signal,
      fetchWrap: (fetchImpl) => expireOnCall(5, controller, fetchImpl),
    });
    const report = reportOf(result);
    expect(report.steps[5]?.outcome).toBe("echec");
    expect(report.steps[6]?.outcome).toBe("non_teste");
    expect(report.manualCleanup).toHaveLength(2);
    expect([...rows.values()][0]).toMatchObject({ state: "creee", lastErrorCode: "nettoyage_incomplet" });
  });
});
