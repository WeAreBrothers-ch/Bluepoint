import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyResponse, jsonResponse } from "./test-support";
import {
  deleteInvoiceCalls, fakePrisma, happyScript, invoiceResponse, makeRunner, methodsOf, reportOf, rows, withStep,
} from "./trial.test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: fakePrisma }));

const { runConnectionTrial } = await import("./trial.server");
const run = makeRunner(runConnectionTrial);

/** Dans le scénario nominal : 6 = relecture avant suppression, 7 = suppression, 8 = relecture après, 9 = client. */
beforeEach(() => {
  rows.clear();
  vi.clearAllMocks();
});

describe("nettoyage : seulement un brouillon", () => {
  it("facture relue « envoyée » : AUCUNE suppression n'est envoyée, consignes données et mémorisées", async () => {
    const script = withStep(6, invoiceResponse("sent"), false);
    const { result, calls } = await run(script);
    const report = reportOf(result);
    expect(deleteInvoiceCalls(calls)).toHaveLength(0);
    expect(methodsOf(calls)).not.toContain("DELETE");
    expect(report.steps[6]?.outcome).toBe("non_teste");
    expect(report.manualCleanup[0]).toContain("n’est pas un brouillon (état envoyée, n° 2026-0042)");
    expect(report.manualCleanup[0]).toContain("voyez avec votre comptable");
    expect([...rows.values()][0]?.lastErrorCode).toBe("non_brouillon");
  });

  it("facture « envoyée » dès l'étape de vérification : l'essai échoue et rien n'est supprimé", async () => {
    const script = [...withStep(3, invoiceResponse("sent"), false), invoiceResponse("sent")];
    const { result, calls } = await run(script);
    const report = reportOf(result);
    expect(result.ok).toBe(false);
    expect(report.steps[4]?.outcome).toBe("echec");
    expect(report.steps[5]?.outcome).toBe("non_teste");
    expect(deleteInvoiceCalls(calls)).toHaveLength(0);
    expect(report.manualCleanup[0]).toContain("pas un brouillon");
  });
});

describe("nettoyage : une suppression doit être confirmée", () => {
  it("la suppression répond « introuvable » (404) : pas présenté comme supprimé", async () => {
    const { result, calls } = await run(withStep(7, emptyResponse(404), false));
    const report = reportOf(result);
    expect(result.ok).toBe(true);
    expect(report.steps[6]?.outcome).toBe("echec");
    expect(report.manualCleanup).toHaveLength(2);
    expect(methodsOf(calls)).not.toContain("DELETE");
    expect([...rows.values()][0]?.lastErrorCode).toBe("nettoyage_incomplet");
    expect(report.headline).toContain("pas pu être entièrement effacé");
  });

  it("la suppression réussit mais la facture est encore lisible en brouillon : non confirmé", async () => {
    const { result, calls } = await run(withStep(8, invoiceResponse("draft"), false));
    const report = reportOf(result);
    expect(report.steps[6]?.outcome).toBe("echec");
    expect(report.steps[6]?.message).toContain("pas confirmée");
    expect(report.manualCleanup).toHaveLength(2);
    expect(methodsOf(calls)).not.toContain("DELETE");
  });

  it("la relecture montre la facture annulée : suppression confirmée", async () => {
    const { result } = await run(withStep(8, invoiceResponse("cancelled")));
    expect(reportOf(result).steps[6]?.outcome).toBe("ok");
  });

  it("erreur 500 à la suppression : le client n'est pas touché", async () => {
    const { result, calls } = await run(withStep(7, emptyResponse(500), false));
    expect(reportOf(result).steps[6]?.outcome).toBe("echec");
    expect(methodsOf(calls)).not.toContain("DELETE");
  });

  it("client introuvable (404) à sa suppression : « non confirmé », jamais un succès", async () => {
    const { result } = await run(withStep(9, emptyResponse(404)));
    const report = reportOf(result);
    expect(report.steps[6]?.outcome).toBe("echec");
    expect(report.steps[6]?.message).toContain("pas confirmée");
    expect(report.manualCleanup).toHaveLength(1);
    expect([...rows.values()][0]?.lastErrorCode).toBe("nettoyage_incomplet");
  });

  it("client encore utilisé (409) : on le laisse et on l'indique", async () => {
    const { result } = await run(withStep(9, emptyResponse(409)));
    const report = reportOf(result);
    expect(report.steps[6]?.outcome).toBe("echec");
    expect(report.steps[6]?.message).toContain("reste dans AbaNinja");
    expect(report.manualCleanup).toHaveLength(1);
  });
});

describe("nettoyage : après un échec d'une autre étape", () => {
  it("PDF invalide : l'essai échoue mais l'essai est quand même effacé", async () => {
    const { result, calls } = await run(withStep(5, new Response("pas un pdf", { status: 200 })));
    const report = reportOf(result);
    expect(result.ok).toBe(false);
    expect(report.steps[5]?.outcome).toBe("echec");
    expect(report.steps[6]?.outcome).toBe("ok");
    expect(deleteInvoiceCalls(calls)).toHaveLength(1);
  });

  it("adresse de téléchargement hors liste blanche : étape PDF en échec, nettoyage tenté, aucun appel vers ce domaine", async () => {
    const evil = jsonResponse({ data: { downloadUrl: "https://evil.example/fichier.pdf" } });
    const script = withStep(4, evil);
    script.splice(5, 1); // pas de téléchargement du PDF : la suite du scénario avance d'un cran
    const { result, calls } = await run(script);
    const report = reportOf(result);
    expect(report.steps[5]?.outcome).toBe("echec");
    expect(report.steps[6]?.outcome).toBe("ok");
    expect(calls.some((call) => call.url.includes("evil.example"))).toBe(false);
    expect(deleteInvoiceCalls(calls)).toHaveLength(1);
  });

  it("la base ne note pas la facture créée : verrou « incertaine » avec un code explicite, nettoyage tenté", async () => {
    fakePrisma.abaNinjaInvoice.updateMany.mockRejectedValueOnce(new Error("base HS"));
    const script = happyScript();
    script.splice(3, 3); // ni relecture, ni PDF : la vérification est sautée quand la création n'est pas notée
    const { result, calls } = await run(script);
    const report = reportOf(result);
    expect(result.ok).toBe(false);
    expect(report.steps[3]?.outcome).toBe("echec");
    expect([...rows.values()][0]).toMatchObject({ state: "incertaine", lastErrorCode: "creation_non_notee" });
    expect(deleteInvoiceCalls(calls)).toHaveLength(1);
  });
});
