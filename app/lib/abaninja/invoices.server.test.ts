import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvoice, CreateInvoiceError } from "./invoices.server";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import {
  emptyResponse,
  jsonResponse,
  OTHER_UUID,
  recordSleeps,
  scriptedFetch,
  TEST_ACCOUNT_UUID,
  TEST_TOKEN,
  testConfig,
  type Scripted,
} from "./test-support";

const logs = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn() }));
vi.mock("../core/logger.server", () => ({ logInfo: logs.info, logError: logs.error }));

const INVOICE_UUID = "44444444-4444-4444-8444-444444444444";
const QUEUE_UUID = "55555555-5555-4555-8555-555555555555";
const SECRET = "Dupont Jean, Rue Secrète 3";

const input: AbaNinjaInvoiceInput = {
  receiver: { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" },
  bankAccountUuid: "11111111-1111-4111-8111-111111111111",
  reference: "BP-1042",
  title: "Commande #1042",
  invoiceDate: "2026-11-10",
  dueDate: "2026-12-10",
  pricesIncludeVat: true,
  terms: "Paiement à 30 jours net.\nMerci.",
  positions: [
    { positionNumber: 1, description: "Chasselas 2023, 75 cl", quantity: 6, unitPrice: 18.5, vatPercentage: 8.1, discountPercentage: 15 },
    { positionNumber: 2, description: "Livraison", quantity: 1, unitPrice: 9, vatPercentage: 8.1 },
  ],
};

const createdBody = { data: { documents: [{ uuid: INVOICE_UUID, systemInvoiceNumber: "2026-0042" }] }, status: 201, message: "ok" };

beforeEach(() => {
  logs.info.mockClear();
  logs.error.mockClear();
});

async function create(script: readonly Scripted[], data: AbaNinjaInvoiceInput = input) {
  const { fetchImpl, calls } = scriptedFetch(script);
  const { sleep, delays } = recordSleeps();
  const result = await createInvoice(testConfig(), data, { fetchImpl, sleep });
  return { result, calls, delays };
}

describe("createInvoice : nominal", () => {
  it("envoie le bon corps et renvoie uuid + numéro", async () => {
    const { result, calls } = await create([jsonResponse(createdBody, 201)]);
    expect(result).toEqual({ ok: true, value: { uuid: INVOICE_UUID, systemInvoiceNumber: "2026-0042" } });
    expect(calls[0]?.url).toBe(`https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/documents/v2/invoices`);
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0]).toMatchObject({
      currencyCode: "CHF",
      reference: "BP-1042",
      invoiceDate: "2026-11-10",
      dueDate: "2026-12-10",
      pricesIncludeVat: true,
      paymentInstructions: { bankAccountUuid: input.bankAccountUuid },
      receiver: input.receiver,
    });
    expect(body.documents[0].positions[0]).toEqual({
      positionNumber: 1,
      kind: "product",
      productDescription: "Chasselas 2023, 75 cl",
      quantity: 6,
      singlePrice: 18.5,
      vat: { percentage: 8.1 },
      discount: { percentage: 15 },
    });
  });

  it("numéro de facture absent -> null", async () => {
    const { result } = await create([jsonResponse({ data: { documents: [{ uuid: INVOICE_UUID }] } }, 201)]);
    expect(result.ok && result.value.systemInvoiceNumber).toBeNull();
  });
});

describe("createInvoice : entrées invalides refusées avant tout appel réseau", () => {
  const bad = (patch: Record<string, unknown>): AbaNinjaInvoiceInput =>
    ({ ...input, ...patch }) as unknown as AbaNinjaInvoiceInput;
  const position = (patch: object): unknown[] => [{ ...input.positions[0], ...patch }];

  it.each([
    ["devise EUR", bad({ currencyCode: "EUR" })],
    ["date inexistante", bad({ invoiceDate: "2026-02-31" })],
    ["date mal formée", bad({ invoiceDate: "10.11.2026" })],
    ["échéance avant la facture", bad({ dueDate: "2026-11-09" })],
    ["aucune position", bad({ positions: [] })],
    ["numérotation avec trou", bad({ positions: [...position({ positionNumber: 1 }), ...position({ positionNumber: 3 })] })],
    ["numérotation en double", bad({ positions: [...position({ positionNumber: 1 }), ...position({ positionNumber: 1 })] })],
    ["numérotation ne commençant pas à 1", bad({ positions: position({ positionNumber: 2 }) })],
    ["quantité nulle", bad({ positions: position({ quantity: 0 }) })],
    ["quantité négative", bad({ positions: position({ quantity: -1 }) })],
    ["quantité à 4 décimales", bad({ positions: position({ quantity: 1.0001 }) })],
    ["prix négatif", bad({ positions: position({ unitPrice: -1 }) })],
    ["prix à 3 décimales", bad({ positions: position({ unitPrice: 1.005 }) })],
    ["prix infini", bad({ positions: position({ unitPrice: Infinity }) })],
    ["TVA à 101 %", bad({ positions: position({ vatPercentage: 101 }) })],
    ["TVA négative", bad({ positions: position({ vatPercentage: -1 }) })],
    ["description vide", bad({ positions: position({ description: " " }) })],
    ["description avec contrôle", bad({ positions: position({ description: "a\u0007b" }) })],
    ["titre trop long", bad({ title: "x".repeat(76) })],
    ["référence vide", bad({ reference: "" })],
    ["conditions trop longues", bad({ terms: "x".repeat(2001) })],
    ["compte bancaire non UUID", bad({ bankAccountUuid: "../etc" })],
    ["destinataire sans adresse", bad({ receiver: { companyUuid: input.bankAccountUuid } })],
    ["champ inconnu", bad({ force: true })],
  ])("%s", async (_label, data) => {
    const { result, calls } = await create([jsonResponse(createdBody, 201)], data);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBeInstanceOf(CreateInvoiceError);
    expect(!result.ok && result.error.outcome).toBe("refusee");
    expect(calls).toHaveLength(0);
  });

  it("quantité décimale raisonnable et prix à 0 acceptés", async () => {
    const { result } = await create([jsonResponse(createdBody, 201)], bad({ positions: position({ quantity: 0.75, unitPrice: 0 }) }));
    expect(result.ok).toBe(true);
  });
});

describe("createInvoice : outcome refusee / incertaine, jamais de réessai", () => {
  it.each([400, 401, 403, 404, 409, 413, 422])("statut %i -> refusee", async (status) => {
    const { result, calls, delays } = await create([jsonResponse({ message: SECRET }, status), jsonResponse(createdBody, 201)]);
    expect(!result.ok && result.error.outcome).toBe("refusee");
    expect(!result.ok && result.error.message).toContain("n'a pas été créée");
    expect(calls).toHaveLength(1);
    expect(delays).toHaveLength(0);
  });

  it.each([408, 418, 425, 429, 499, 500, 502, 503])("statut %i -> incertaine", async (status) => {
    const { result, calls } = await create([emptyResponse(status), jsonResponse(createdBody, 201)]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
    expect(!result.ok && result.error.message).toContain("peut-être été créée");
    expect(calls).toHaveLength(1);
  });

  it("délai dépassé -> incertaine", async () => {
    const { result, calls } = await create([Object.assign(new Error("t"), { name: "TimeoutError" })]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
    expect(calls).toHaveLength(1);
  });

  it("erreur réseau -> incertaine", async () => {
    const { result } = await create([new TypeError("fetch failed")]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
  });

  it("réponse 2xx illisible -> incertaine", async () => {
    const { result } = await create([jsonResponse({ data: { documents: [{ uuid: "pas-un-uuid" }] } }, 201)]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
  });

  it("redirection -> incertaine", async () => {
    const { result } = await create([emptyResponse(302, { location: "https://evil.test/" })]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
  });

  it("202 asynchrone -> incertaine avec queueUuid", async () => {
    const { result } = await create([jsonResponse({ data: { status: "https://x/queue", queueUuid: QUEUE_UUID } }, 202)]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
    expect(!result.ok && result.error.queueUuid).toBe(QUEUE_UUID);
  });

  it("plusieurs factures renvoyées -> incertaine", async () => {
    const two = { data: { documents: [{ uuid: INVOICE_UUID }, { uuid: OTHER_UUID }] } };
    const { result } = await create([jsonResponse(two, 201)]);
    expect(!result.ok && result.error.outcome).toBe("incertaine");
  });

  it("aucune donnée client ni jeton dans les messages ni les journaux", async () => {
    const { result } = await create([jsonResponse({ message: SECRET, token: TEST_TOKEN }, 400)]);
    const text = JSON.stringify([!result.ok && result.error.message, logs.info.mock.calls, logs.error.mock.calls]);
    expect(text).not.toContain("Secrète");
    expect(text).not.toContain(TEST_TOKEN);
    expect(text).not.toContain("Chasselas");
  });
});
