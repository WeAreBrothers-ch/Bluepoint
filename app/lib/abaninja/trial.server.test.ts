import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_TOKEN } from "./test-support";
import {
  expectNoSecret, fakePrisma, happyScript, INVOICE_UUID, makeRunner, methodsOf, reportOf, rows, seedTrial, SHOP,
} from "./trial.test-support";
import { TrialBlockedError } from "./trial-types";

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("../core/logger.server", () => ({ logInfo: logs.info, logError: logs.error }));
vi.mock("../../db.server", () => ({ default: fakePrisma }));

const { runConnectionTrial } = await import("./trial.server");
const run = makeRunner(runConnectionTrial);

beforeEach(() => {
  rows.clear();
  logs.error.mockClear();
  vi.clearAllMocks();
});

describe("essai de connexion : chemin nominal", () => {
  it("passe les 7 étapes, efface l'essai, le confirme, et ne montre aucun secret", async () => {
    const { result, calls } = await run(happyScript());
    const report = reportOf(result);
    expect(result.ok).toBe(true);
    expect(report.steps.map((step) => step.outcome)).toEqual(Array(7).fill("ok"));
    expect(report.manualCleanup).toEqual([]);
    expect(report.reference).toBe("BP-ESSAI-20261110-120000");
    expect(report.invoiceNumber).toBe("2026-0042");
    expect(methodsOf(calls)).toEqual(["GET", "POST", "POST", "GET", "PATCH", "GET", "GET", "PATCH", "GET", "DELETE"]);
    expect(calls[7]?.url).toContain(`/${INVOICE_UUID}/actions/delete`);
    expectNoSecret(report);
  });

  it("n'envoie jamais rien à un client : ni dans les adresses, ni dans les corps de requêtes", async () => {
    const { calls } = await run(happyScript());
    const forbiddenUrl = /markSent|\/send|\/email|sendEmail/i;
    const forbiddenBody = /markSent|sendEmail|send_email|"send"\s*:|"sendTo"/i;
    for (const call of calls) {
      expect(new URL(call.url).pathname).not.toMatch(forbiddenUrl);
      expect(String(call.init.body ?? "")).not.toMatch(forbiddenBody);
    }
  });

  it("note l'essai en base comme essai de test, en brouillon", async () => {
    await run(happyScript());
    const [row] = [...rows.values()];
    expect(row).toMatchObject({ isTest: true, state: "creee", status: "brouillon", reference: "BP-ESSAI-20261110-120000" });
  });

  it("n'envoie le jeton qu'à AbaNinja et ne le met dans aucun journal", async () => {
    await run(happyScript());
    expect(JSON.stringify(logs.error.mock.calls)).not.toContain(TEST_TOKEN);
  });
});

describe("essai de connexion : option « garder la facture »", () => {
  it("saute le nettoyage, dit quoi supprimer à la main et le mémorise en base", async () => {
    const { result, calls } = await run(happyScript().slice(0, 6), { keepInvoice: true });
    const report = reportOf(result);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(6);
    expect(report.steps[6]?.outcome).toBe("non_teste");
    expect(report.manualCleanup.join(" ")).toContain("BP-ESSAI-20261110-120000");
    expect(report.notes.join(" ")).toContain("bulletin QR");
    expect([...rows.values()][0]).toMatchObject({ state: "creee", lastErrorCode: "gardee" });
  });
});

describe("essai de connexion : garde-fous", () => {
  it("refuse un 2e essai dans la minute : rapport « bloqué », sans étapes ni appel", async () => {
    seedTrial("creee", 30_000);
    const { result, calls } = await run(happyScript());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(TrialBlockedError);
    expect(calls).toHaveLength(0);
    expect(!result.ok && result.error.message).toContain("une minute");
  });

  it("accepte un essai fait il y a plus d'une minute", async () => {
    seedTrial("creee", 120_000);
    expect((await run(happyScript())).result.ok).toBe(true);
  });

  it("bloque tant qu'un essai précédent est incertain, avec le moyen de se débloquer", async () => {
    seedTrial("incertaine", 3 * 60 * 60 * 1000);
    const { result, calls } = await run(happyScript());
    expect(!result.ok && result.error).toBeInstanceOf(TrialBlockedError);
    expect(calls).toHaveLength(0);
    expect(!result.ok && result.error.message).toMatch(/incertain.*30 minutes.*6 heures/s);
  });

  it("ne bloque plus après 6 heures", async () => {
    seedTrial("incertaine", 7 * 60 * 60 * 1000);
    expect((await run(happyScript())).result.ok).toBe(true);
  });

  it("ne regarde que les essais de cette boutique : ni autre boutique, ni vraie facture", async () => {
    seedTrial("incertaine", 10_000, { orderId: "essai-autre", shop: "autre.myshopify.com" });
    seedTrial("incertaine", 10_000, { orderId: "commande-1042", isTest: false });
    seedTrial("incertaine", 10_000, { orderId: "commande-2000" });
    expect((await run(happyScript())).result.ok).toBe(true);
    expect(fakePrisma.abaNinjaInvoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shop: SHOP, isTest: true, orderId: { startsWith: "essai-" } } }),
    );
  });

  it("double clic : le verrou déjà pris donne un message clair, sans rien créer", async () => {
    seedTrial("en_cours", 5_000, { orderId: `essai-${SHOP}-${Math.floor(Date.parse("2026-11-10T12:00:00Z") / 60_000)}` });
    fakePrisma.abaNinjaInvoice.findFirst.mockResolvedValueOnce(null);
    const { result, calls } = await run(happyScript());
    expect(!result.ok && result.error).toBeInstanceOf(TrialBlockedError);
    expect(!result.ok && result.error.message).toContain("déjà démarré");
    expect(methodsOf(calls)).toEqual(["GET"]);
  });

  it("base illisible : message neutre, aucun appel à AbaNinja", async () => {
    fakePrisma.abaNinjaInvoice.findFirst.mockRejectedValueOnce(new Error("base HS"));
    const { result, calls } = await run(happyScript());
    expect(!result.ok && result.error).toBeInstanceOf(TrialBlockedError);
    expect(calls).toHaveLength(0);
  });
});
