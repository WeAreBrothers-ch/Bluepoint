import { Prisma } from "@prisma/client";
import { vi } from "vitest";
import type { TrialOptions, TrialResult } from "./trial.server";
import { emptyResponse, jsonResponse, scriptedFetch, TEST_ACCOUNT_UUID, TEST_TOKEN, type RecordedCall, type Scripted } from "./test-support";
import { TrialError, type TrialReport } from "./trial-types";

/**
 * Réservé aux tests de l'essai de connexion (jamais importé par le code de l'application) :
 * base simulée en mémoire, qui applique vraiment les filtres, et scénarios AbaNinja.
 */

export const SHOP = "boutique.myshopify.com";
export const NOW = new Date("2026-11-10T12:00:00.000Z");
export const ENV = { ABANINJA_TOKEN: TEST_TOKEN, ABANINJA_ACCOUNT_UUID: TEST_ACCOUNT_UUID };
const BANK_UUID = "55555555-5555-4555-8555-555555555555";
export const COMPANY_UUID = "33333333-3333-4333-8333-333333333333";
const POSTAL_UUID = "22222222-2222-4222-8222-222222222222";
export const INVOICE_UUID = "44444444-4444-4444-8444-444444444444";

export interface Row {
  orderId: string;
  reference: string;
  state: string;
  shop: string;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastErrorCode?: string | null;
  status?: string;
}

type NewRow = Omit<Row, "createdAt" | "updatedAt">;
type Where = { shop?: string; isTest?: boolean; orderId?: string | { startsWith: string }; state?: string };

export const rows = new Map<string, Row>();

function uniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("doublon", { code: "P2002", clientVersion: "test" });
}

function matchesOrder(row: Row, orderId: Where["orderId"]): boolean {
  if (orderId === undefined) return true;
  return typeof orderId === "string" ? row.orderId === orderId : row.orderId.startsWith(orderId.startsWith);
}

/** Applique TOUS les filtres demandés : une requête mal filtrée doit se voir dans les tests. */
function matches(row: Row, where: Where): boolean {
  return (
    (where.shop === undefined || row.shop === where.shop) &&
    (where.isTest === undefined || row.isTest === where.isTest) &&
    (where.state === undefined || row.state === where.state) &&
    matchesOrder(row, where.orderId)
  );
}

export const fakePrisma = {
  abaNinjaInvoice: {
    create: vi.fn(async ({ data }: { data: NewRow }) => {
      if ([...rows.values()].some((r) => r.orderId === data.orderId || r.reference === data.reference)) throw uniqueError();
      const row: Row = { ...data, createdAt: NOW, updatedAt: NOW };
      rows.set(data.orderId, row);
      return { ...row };
    }),
    findUnique: vi.fn(async ({ where }: { where: { orderId: string } }) => {
      const row = rows.get(where.orderId);
      return row ? { ...row } : null;
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Where; data: Record<string, unknown> }) => {
      const found = [...rows.values()].filter((row) => matches(row, where));
      for (const row of found) Object.assign(row, data, { updatedAt: NOW });
      return { count: found.length };
    }),
    findFirst: vi.fn(async ({ where }: { where: Where }) => {
      const found = [...rows.values()].filter((row) => matches(row, where));
      found.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return found[0] ? { ...found[0] } : null;
    }),
  },
};

export interface SeedOptions {
  readonly orderId?: string;
  /** Depuis combien de temps la ligne n'a pas bougé (par défaut : son âge). */
  readonly idleMs?: number;
  readonly shop?: string;
  readonly isTest?: boolean;
  readonly lastErrorCode?: string;
}

/** Ajoute un ancien essai en base. */
export function seedTrial(state: string, ageMs: number, options: SeedOptions = {}): Row {
  const orderId = options.orderId ?? "essai-ancien";
  const row: Row = {
    orderId,
    reference: `BP-ESSAI-20261110-${orderId.length.toString().padStart(6, "0")}`,
    state,
    shop: options.shop ?? SHOP,
    isTest: options.isTest ?? true,
    createdAt: new Date(NOW.getTime() - ageMs),
    updatedAt: new Date(NOW.getTime() - (options.idleMs ?? ageMs)),
    ...(options.lastErrorCode === undefined ? {} : { lastErrorCode: options.lastErrorCode }),
  };
  rows.set(orderId, row);
  return row;
}

const BANK_OK = {
  data: [{ uuid: BANK_UUID, name: "Compte", isActive: true, isDefault: true, qrBill: { active: true, qrIban: "CH4431999123000889012" } }],
};
export const BANK_WITHOUT_QR = { data: [{ uuid: BANK_UUID, name: "Compte", isActive: true, isDefault: true, qrBill: { active: false } }] };

export function pdfResponse(size = 4_000): Response {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7"));
  return new Response(bytes, { status: 200 });
}

export function invoiceResponse(status: string): Response {
  return jsonResponse({ data: { uuid: INVOICE_UUID, status, openAmount: 1, systemInvoiceNumber: "2026-0042" } });
}

export const COMPANY_WITHOUT_ADDRESS = jsonResponse({ data: { uuid: COMPANY_UUID } }, 201);

/** Les 10 réponses d'un essai réussi, dans l'ordre des appels (lire ci-dessous pour le détail). */
export function happyScript(): Scripted[] {
  return [
    jsonResponse(BANK_OK), // 0 comptes bancaires
    jsonResponse({ data: { uuid: COMPANY_UUID, addresses: [{ uuid: POSTAL_UUID }] } }, 201), // 1 client
    jsonResponse({ data: { documents: [{ uuid: INVOICE_UUID, systemInvoiceNumber: "2026-0042" }] } }, 201), // 2 facture
    invoiceResponse("draft"), // 3 relecture (étape statut)
    jsonResponse({ data: { downloadUrl: "https://api.abaninja.ch/files/1" } }), // 4 adresse du PDF
    pdfResponse(), // 5 PDF
    invoiceResponse("draft"), // 6 relecture avant suppression
    jsonResponse({ data: {} }), // 7 suppression de la facture
    emptyResponse(404), // 8 relecture après suppression : introuvable = confirmé
    emptyResponse(204), // 9 suppression du client
  ];
}

/** Remplace la réponse numéro `index` du scénario nominal ; coupe la suite si `keepTail` est faux. */
export function withStep(index: number, response: Scripted, keepTail = true): Scripted[] {
  const script = happyScript();
  script[index] = response;
  return keepTail ? script : script.slice(0, index + 1);
}

export function reportOf(result: TrialResult): TrialReport {
  if (result.ok) return result.value;
  if (result.error instanceof TrialError) return result.error.report;
  throw new Error("Essai refusé : pas de rapport");
}

export function methodsOf(calls: readonly RecordedCall[]): string[] {
  return calls.map((call) => String(call.init.method));
}

export function deleteInvoiceCalls(calls: readonly RecordedCall[]): RecordedCall[] {
  return calls.filter((call) => call.url.endsWith("/actions/delete"));
}

export function expectNoSecret(report: TrialReport): string {
  const text = JSON.stringify(report);
  const lastChars = TEST_ACCOUNT_UUID.slice(-4);
  if (text.includes(TEST_TOKEN) || text.includes(TEST_ACCOUNT_UUID) || text.includes(lastChars)) {
    throw new Error("Secret (ou morceau d’identifiant de compte) trouvé dans le rapport");
  }
  return text;
}

/** Faux fetch qui déclenche l'échéance globale à l'appel numéro `callNumber` (à partir de 1) puis échoue. */
export function expireOnCall(callNumber: number, controller: AbortController, fetchImpl: typeof fetch): typeof fetch {
  let count = 0;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    count += 1;
    if (count === callNumber) {
      controller.abort();
      throw new DOMException("délai dépassé", "TimeoutError");
    }
    return fetchImpl(input, init);
  }) as typeof fetch;
}

export interface Runner {
  (script: readonly Scripted[], options?: TrialOptions & { fetchWrap?: (f: typeof fetch) => typeof fetch }): Promise<{
    result: TrialResult;
    calls: RecordedCall[];
  }>;
}

/** Lance l'essai avec un faux AbaNinja ; `run` est runConnectionTrial, importé dans le fichier de test après les mocks. */
export function makeRunner(run: (shop: string, options: TrialOptions) => Promise<TrialResult>): Runner {
  return async (script, options = {}) => {
    const { fetchWrap, ...rest } = options;
    const scripted = scriptedFetch(script);
    const fetchImpl = fetchWrap === undefined ? scripted.fetchImpl : fetchWrap(scripted.fetchImpl);
    const result = await run(SHOP, { env: ENV, now: () => NOW, ...rest, call: { fetchImpl, sleep: () => Promise.resolve() } });
    return { result, calls: scripted.calls };
  };
}

