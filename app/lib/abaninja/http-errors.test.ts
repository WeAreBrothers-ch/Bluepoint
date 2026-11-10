import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { abaNinjaRequest } from "./http.server";
import { jsonResponse, OTHER_UUID, scriptedRequestOptions as baseOptions } from "./test-support";

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("../core/logger.server", () => ({ logInfo: logs.info, logError: logs.error }));

const schema = z.object({ id: z.string() });

beforeEach(() => {
  logs.info.mockClear();
  logs.error.mockClear();
});

describe("abaNinjaRequest : journal du détail d'un refus", () => {
  const REQUEST_UUID = "5f1c9a2e-0000-4000-8000-00000000abcd";

  it("journalise requestUuid, type et NOMS des champs, jamais les valeurs ni le corps", async () => {
    const body = {
      type: "validation_error",
      status: 422,
      requestUuid: REQUEST_UUID,
      detail: { email: "jean.dupont@example.ch", "addresses.0.city": "Lausanne" },
      title: "Données Secrètes",
    };
    const { options } = baseOptions([jsonResponse(body, 422)]);
    const result = await abaNinjaRequest({ ...options, schema });
    const written = JSON.stringify(logs.info.mock.calls);
    expect(written).toContain(REQUEST_UUID);
    expect(written).toContain("validation_error");
    expect(written).toContain("email,addresses.0.city");
    expect(written).not.toContain("jean.dupont");
    expect(written).not.toContain("Lausanne");
    expect(written).not.toContain("Secrètes");
    expect(!result.ok && result.error.message).not.toContain("jean.dupont");
    expect(!result.ok && result.error.message).not.toContain("validation_error");
  });

  it("gère le format de l'API Adresses : seul le code `error` est journalisé", async () => {
    const body = { error: "invalid_token", error_description: "Le jeton de Jean Dupont a expiré" };
    const { options } = baseOptions([jsonResponse(body, 401)]);
    await abaNinjaRequest({ ...options, schema });
    const written = JSON.stringify(logs.info.mock.calls);
    expect(written).toContain("invalid_token");
    expect(written).not.toContain("Dupont");
  });

  it("journalise la forme du corps (chemins de clés), jamais les valeurs", async () => {
    const body = { message: "Texte libre de Jean Dupont", errors: { language: ["valeur secrète"], "tags.0": ["x"] } };
    const { options } = baseOptions([jsonResponse(body, 422)]);
    await abaNinjaRequest({ ...options, schema });
    const written = JSON.stringify(logs.info.mock.calls);
    expect(written).toContain("errors.language");
    expect(written).toContain("errors.tags.0");
    expect(written).not.toContain("Dupont");
    expect(written).not.toContain("secrète");
  });

  it("pour une action sur un document, journalise aussi le message du service", async () => {
    const body = { message: "Le document est un brouillon", detail: "Pas de PDF avant envoi", type: "invalid_request" };
    const { options } = baseOptions([jsonResponse(body, 400)], { path: ["invoices", { uuid: OTHER_UUID }, "actions", "downloadPdf"] });
    await abaNinjaRequest({ ...options, schema });
    const written = JSON.stringify(logs.info.mock.calls);
    expect(written).toContain("Le document est un brouillon");
    expect(written).toContain("Pas de PDF avant envoi");
  });

  it("hors action, le message libre n'est jamais journalisé", async () => {
    const { options } = baseOptions([jsonResponse({ message: "Jean Dupont est invalide" }, 422)]);
    await abaNinjaRequest({ ...options, schema });
    expect(JSON.stringify(logs.info.mock.calls)).not.toContain("Dupont");
  });

  it("un corps d'erreur illisible ou trop gros ne casse rien", async () => {
    const huge = new Response("x".repeat(20 * 1024), { status: 400 });
    const { options } = baseOptions([huge]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("donnees_refusees");
    const garbage = baseOptions([new Response("<html>oups</html>", { status: 400 })]);
    expect((await abaNinjaRequest({ ...garbage.options, schema })).ok).toBe(false);
  });
});

describe("abaNinjaRequest : échéance globale", () => {
  it("une échéance déjà dépassée n'envoie rien", async () => {
    const controller = new AbortController();
    controller.abort();
    const { options, calls } = baseOptions([jsonResponse({ id: "a" })], { signal: controller.signal });
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("indisponible");
    expect(calls).toHaveLength(0);
  });

  it("une annulation pendant l'appel arrête les réessais et les pauses", async () => {
    const controller = new AbortController();
    const abortingFetch = ((): Promise<Response> => {
      controller.abort();
      return Promise.reject(new DOMException("annulé", "AbortError"));
    }) as typeof fetch;
    const { options, delays } = baseOptions([], { signal: controller.signal, fetchImpl: abortingFetch });
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("indisponible");
    expect(delays).toHaveLength(0);
  });

  it("une annulation transmise à fetch est visible dans son signal", async () => {
    const controller = new AbortController();
    const { options, calls } = baseOptions([jsonResponse({ id: "a" })], { signal: controller.signal });
    await abaNinjaRequest({ ...options, schema });
    controller.abort();
    expect((calls[0]?.init.signal as AbortSignal).aborted).toBe(true);
  });
});
