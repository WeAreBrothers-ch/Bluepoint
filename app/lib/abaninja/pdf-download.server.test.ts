import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadInvoicePdf } from "./pdf-download.server";
import { emptyResponse, jsonResponse, scriptedFetch, TEST_TOKEN, testConfig, type Scripted } from "./test-support";

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("../core/logger.server", () => ({ logInfo: logs.info, logError: logs.error }));

const INVOICE_UUID = "44444444-4444-4444-8444-444444444444";
const PDF_BYTES = new TextEncoder().encode("%PDF-1.7 contenu");

function urlResponse(downloadUrl: string): Response {
  return jsonResponse({ data: { downloadUrl }, status: 200 });
}

function pdfResponse(bytes: Uint8Array<ArrayBuffer> = PDF_BYTES): Response {
  return new Response(bytes, { status: 200, headers: { "content-type": "application/pdf" } });
}

async function download(script: readonly Scripted[]) {
  const { fetchImpl, calls } = scriptedFetch(script);
  const result = await downloadInvoicePdf(testConfig(), INVOICE_UUID, { fetchImpl, sleep: () => Promise.resolve() });
  return { result, calls };
}

function authorizationOf(call: { init: RequestInit } | undefined): string | undefined {
  return (call?.init.headers as Record<string, string> | undefined)?.["Authorization"];
}

beforeEach(() => {
  logs.info.mockClear();
  logs.error.mockClear();
});

describe("downloadInvoicePdf : nominal", () => {
  it("télécharge en deux temps depuis api.abaninja.ch, avec le jeton", async () => {
    const { result, calls } = await download([urlResponse("https://api.abaninja.ch/files/1"), pdfResponse()]);
    expect(result.ok && new TextDecoder().decode(result.value)).toBe("%PDF-1.7 contenu");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.url).toBe("https://api.abaninja.ch/files/1");
    expect(calls[1]?.init.redirect).toBe("manual");
    expect(authorizationOf(calls[1])).toBe(`Bearer ${TEST_TOKEN}`);
  });

  it("depuis un autre sous-domaine abaninja.ch : aucun en-tête Authorization", async () => {
    const { result, calls } = await download([urlResponse("https://files.abaninja.ch/1.pdf"), pdfResponse()]);
    expect(result.ok).toBe(true);
    expect(authorizationOf(calls[1])).toBeUndefined();
    expect(JSON.stringify(calls[1]?.init.headers)).not.toContain(TEST_TOKEN);
  });
});

describe("downloadInvoicePdf : adresse de téléchargement refusée (aucun 2e appel)", () => {
  it.each([
    ["http", "http://api.abaninja.ch/f"],
    ["autre domaine", "https://example.com/f.pdf"],
    ["api.abaninja.ch.evil.com", "https://api.abaninja.ch.evil.com/f"],
    ["evil.com/.abaninja.ch", "https://evil.com/.abaninja.ch"],
    ["identifiants", "https://u:p@api.abaninja.ch/f"],
    ["IP", "https://10.0.0.1/f"],
    ["IPv6", "https://[::1]/f"],
    ["port", "https://api.abaninja.ch:444/f"],
  ])("%s", async (_label, url) => {
    const { result, calls } = await download([urlResponse(url), pdfResponse()]);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
    const logged = JSON.stringify([logs.info.mock.calls, logs.error.mock.calls]);
    expect(logged).not.toContain(url);
    expect(logged).not.toContain(TEST_TOKEN);
  });
});

describe("downloadInvoicePdf : téléchargement", () => {
  it("ne suit jamais une redirection", async () => {
    const redirect = emptyResponse(302, { location: "https://evil.test/steal" });
    const { result, calls } = await download([urlResponse("https://api.abaninja.ch/f"), redirect, pdfResponse()]);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("refuse un contenu qui n'est pas un PDF", async () => {
    const html = new Response("<html>erreur</html>", { status: 200 });
    const { result } = await download([urlResponse("https://api.abaninja.ch/f"), html]);
    expect(!result.ok && result.error.message).toContain("pas un PDF");
  });

  it("refuse un PDF de plus de 10 Mo (déclaré)", async () => {
    const big = new Response(PDF_BYTES, { status: 200, headers: { "content-length": String(11 * 1024 * 1024) } });
    const { result } = await download([urlResponse("https://api.abaninja.ch/f"), big]);
    expect(!result.ok && result.error.message).toContain("trop volumineuse");
  });

  it("refuse un PDF de plus de 10 Mo (flux sans taille déclarée)", async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(0x41);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(PDF_BYTES);
        for (let i = 0; i < 11; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const { result } = await download([urlResponse("https://api.abaninja.ch/f"), new Response(stream, { status: 200 })]);
    expect(!result.ok && result.error.message).toContain("trop volumineuse");
  });

  it.each([
    [401, "non_autorise"],
    [403, "non_autorise"],
    [404, "introuvable"],
    [500, "indisponible"],
  ] as const)("statut %i au téléchargement -> %s", async (status, code) => {
    const { result } = await download([urlResponse("https://api.abaninja.ch/f"), emptyResponse(status)]);
    expect(!result.ok && result.error.code).toBe(code);
  });

  it("erreur réseau au téléchargement -> indisponible", async () => {
    const { result } = await download([urlResponse("https://api.abaninja.ch/f"), new TypeError("fetch failed")]);
    expect(!result.ok && result.error.code).toBe("indisponible");
  });

  it("l'échec de la première étape est remonté tel quel", async () => {
    const { result, calls } = await download([emptyResponse(404)]);
    expect(!result.ok && result.error.code).toBe("introuvable");
    expect(calls).toHaveLength(1);
  });
});
