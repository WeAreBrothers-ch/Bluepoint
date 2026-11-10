import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { abaNinjaRequest } from "./http.server";
import {
  emptyResponse,
  jsonResponse,
  OTHER_UUID,
  scriptedRequestOptions as baseOptions,
  TEST_TOKEN,
} from "./test-support";

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("../core/logger.server", () => ({ logInfo: logs.info, logError: logs.error }));

const schema = z.object({ id: z.string() });

beforeEach(() => {
  logs.info.mockClear();
  logs.error.mockClear();
});

describe("abaNinjaRequest : requête", () => {
  it("appelle l'hôte fixe avec les bons en-têtes, sans suivre les redirections", async () => {
    const { options, calls } = baseOptions([jsonResponse({ id: "a" })]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(result).toEqual({ ok: true, value: { id: "a" } });
    expect(calls[0]?.url).toBe(`https://api.abaninja.ch/invoices/${OTHER_UUID}`);
    expect(calls[0]?.init.redirect).toBe("manual");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${TEST_TOKEN}`, Accept: "application/json" });
  });

  it("refuse un uuid piégé sans appeler le réseau", async () => {
    const { options, calls } = baseOptions([jsonResponse({ id: "a" })], { path: ["invoices", { uuid: "../x?y=" }] });
    const result = await abaNinjaRequest({ ...options, schema });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("traite une redirection comme une erreur, sans la suivre ni réessayer", async () => {
    const redirect = emptyResponse(302, { location: "https://evil.test/" });
    const { options, calls } = baseOptions([redirect]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
    expect(calls).toHaveLength(1);
  });

  it("envoie le corps JSON d'un POST avec Content-Type", async () => {
    const { options, calls } = baseOptions([jsonResponse({ id: "n" }, 201)], { method: "POST", body: { a: 1 } });
    await abaNinjaRequest({ ...options, schema });
    expect(calls[0]?.init.body).toBe('{"a":1}');
    expect(calls[0]?.init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("abandonne après le délai maximal", async () => {
    const hang = (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const { options } = baseOptions([], { fetchImpl: hang as typeof fetch, timeoutMs: 20 });
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("indisponible");
    expect(!result.ok && result.error.message).toContain("à temps");
  });
});

describe("abaNinjaRequest : erreurs HTTP", () => {
  it.each([
    [401, "non_autorise"],
    [403, "non_autorise"],
    [404, "introuvable"],
    [400, "donnees_refusees"],
    [422, "donnees_refusees"],
  ] as const)("statut %i -> %s, sans réessai", async (status, code) => {
    const { options, calls } = baseOptions([jsonResponse({ client: "Jean Dupont" }, status)]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe(code);
    expect(!result.ok && result.error.retryable).toBe(false);
    expect(!result.ok && result.error.message).not.toContain("Dupont");
    expect(calls).toHaveLength(1);
  });

  it("429 : respecte Retry-After puis réussit", async () => {
    const { options, calls, delays } = baseOptions([
      emptyResponse(429, { "retry-after": "2" }),
      jsonResponse({ id: "ok" }),
    ]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(delays).toEqual([2000]);
  });

  it("5xx sur GET : au plus 2 réessais, puis erreur", async () => {
    const { options, calls, delays } = baseOptions([emptyResponse(503)]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("indisponible");
    expect(calls).toHaveLength(3);
    expect(delays).toHaveLength(2);
  });

  it("erreur réseau sur GET : réessaie", async () => {
    const { options, calls } = baseOptions([new TypeError("fetch failed"), jsonResponse({ id: "ok" })]);
    expect((await abaNinjaRequest({ ...options, schema })).ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("ne réessaie jamais un POST", async () => {
    const { options, calls } = baseOptions([emptyResponse(503)], { method: "POST", body: {} });
    const result = await abaNinjaRequest({ ...options, schema });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("réessaie un PATCH seulement s'il est déclaré sûr", async () => {
    const unsafe = baseOptions([emptyResponse(503)], { method: "PATCH", body: {} });
    await abaNinjaRequest({ ...unsafe.options, schema });
    expect(unsafe.calls).toHaveLength(1);
    const safe = baseOptions([emptyResponse(503)], { method: "PATCH", body: {}, idempotent: true });
    await abaNinjaRequest({ ...safe.options, schema });
    expect(safe.calls).toHaveLength(3);
  });
});

describe("abaNinjaRequest : réponse", () => {
  it("refuse un JSON non conforme au schéma", async () => {
    const { options } = baseOptions([jsonResponse({ id: 42 })]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });

  it("refuse un corps qui n'est pas du JSON", async () => {
    const { options } = baseOptions([new Response("<html>")]);
    const result = await abaNinjaRequest({ ...options, schema });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });

  it("refuse une réponse plus grande que la limite", async () => {
    const { options } = baseOptions([new Response("x".repeat(500))]);
    const result = await abaNinjaRequest({ ...options, schema, maxBytes: 100 });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });

  it("ne journalise ni le jeton, ni l'uuid, ni le corps", async () => {
    const { options } = baseOptions([jsonResponse({ id: "secret-client" }, 500)]);
    await abaNinjaRequest({ ...options, schema });
    const written = JSON.stringify([logs.info.mock.calls, logs.error.mock.calls]);
    expect(written).not.toContain(TEST_TOKEN);
    expect(written).not.toContain(OTHER_UUID);
    expect(written).not.toContain("secret-client");
    expect(written).toContain(":uuid");
  });
});
