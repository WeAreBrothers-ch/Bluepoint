import { readAbaNinjaConfig, type AbaNinjaConfig } from "./config.server";
import type { RequestOptions } from "./http.server";

/** Outils partagés par les tests AbaNinja : aucun appel réseau réel. */

export const TEST_TOKEN = "SECRET-TOKEN-ABCDEFGHIJ1234567890";
export const TEST_ACCOUNT_UUID = "123e4567-e89b-42d3-a456-426614174000";
export const OTHER_UUID = "9b2c1f4e-7a3d-4c8b-9e5f-0a1b2c3d4e5f";

export function testConfig(): AbaNinjaConfig {
  const result = readAbaNinjaConfig({ ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID });
  if (!result.ok) throw result.error;
  return result.value;
}

export interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

export type Scripted = Response | Error;

/** Copie indépendante (un corps de réponse ne se lit qu'une fois, et un flux dupliqué ne s'annule pas seul). */
async function freshCopy(template: Response): Promise<Response> {
  const text = await template.clone().text();
  return new Response(text === "" ? null : text, { status: template.status, headers: template.headers });
}

/** Faux fetch qui rejoue des réponses dans l'ordre et enregistre les appels. */
export function scriptedFetch(script: readonly Scripted[]): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = script[calls.length - 1] ?? script[script.length - 1];
    if (next === undefined) throw new Error("Scénario de test vide");
    if (next instanceof Error) throw next;
    return freshCopy(next);
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

export function recordSleeps(): { sleep: (ms: number) => Promise<void>; delays: number[] } {
  const delays: number[] = [];
  return {
    delays,
    sleep: (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    },
  };
}

/** Options de requête prêtes pour un test : réponses scriptées, pauses enregistrées au lieu d'être attendues. */
export function scriptedRequestOptions(script: readonly Scripted[], extra: Partial<RequestOptions> = {}) {
  const { fetchImpl, calls } = scriptedFetch(script);
  const { sleep, delays } = recordSleeps();
  const options: RequestOptions = {
    config: testConfig(),
    method: "GET",
    path: ["invoices", { uuid: OTHER_UUID }],
    fetchImpl,
    sleep,
    ...extra,
  };
  return { options, calls, delays };
}
