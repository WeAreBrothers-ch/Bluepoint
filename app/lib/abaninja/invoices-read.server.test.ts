import { describe, expect, it, vi } from "vitest";
import { getInvoice, requestInvoicePdfUrl } from "./invoices.server";
import { emptyResponse, jsonResponse, OTHER_UUID, scriptedFetch, TEST_ACCOUNT_UUID, testConfig } from "./test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const INVOICE_UUID = "44444444-4444-4444-8444-444444444444";

describe("getInvoice", () => {
  const record = { uuid: INVOICE_UUID, status: "sent", sentStatus: "SENT", openAmount: 120.5, dueDate: "2026-12-10", systemInvoiceNumber: "2026-0042" };
  const expected = { ...record, isCancelled: undefined };

  it("lit la forme data = objet", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: { ...record, extra: 1 } })]);
    const result = await getInvoice(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result).toEqual({ ok: true, value: expected });
    expect(calls[0]?.url).toBe(`https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/documents/v2/invoices/${INVOICE_UUID}`);
  });

  it("lit la forme data.documents[0]", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: { documents: [{ ...record, isCancelled: false }] } })]);
    const result = await getInvoice(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result).toEqual({ ok: true, value: { ...expected, isCancelled: false } });
  });

  it("accepte un montant en texte et des champs absents", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: { uuid: INVOICE_UUID, status: "draft", openAmount: "10.50" } })]);
    const result = await getInvoice(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result.ok && result.value).toMatchObject({ openAmount: 10.5, dueDate: null, sentStatus: null, systemInvoiceNumber: null });
  });

  it.each([
    ["statut absent", { data: { uuid: INVOICE_UUID } }],
    ["statut non texte", { data: { uuid: INVOICE_UUID, status: 3 } }],
    ["uuid invalide", { data: { uuid: "x", status: "paid" } }],
    ["documents vide", { data: { documents: [] } }],
    ["autre facture", { data: { ...record, uuid: OTHER_UUID } }],
  ])("réponse non conforme (%s) -> reponse_invalide", async (_label, body) => {
    const { fetchImpl } = scriptedFetch([jsonResponse(body)]);
    const result = await getInvoice(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });

  it("refuse un uuid piégé sans appel réseau", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: record })]);
    const result = await getInvoice(testConfig(), "../../x", { fetchImpl });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it.each([
    [401, "non_autorise"],
    [403, "non_autorise"],
    [404, "introuvable"],
    [500, "indisponible"],
  ] as const)("statut %i -> %s", async (status, code) => {
    const { fetchImpl } = scriptedFetch([emptyResponse(status)]);
    const result = await getInvoice(testConfig(), INVOICE_UUID, { fetchImpl, sleep: () => Promise.resolve() });
    expect(!result.ok && result.error.code).toBe(code);
  });
});

describe("requestInvoicePdfUrl", () => {
  it("downloadPdf : renvoie l'adresse de téléchargement", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: { downloadUrl: "https://api.abaninja.ch/f/1" } })]);
    const result = await requestInvoicePdfUrl(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result).toEqual({ ok: true, value: "https://api.abaninja.ch/f/1" });
    expect(calls[0]?.url.endsWith(`/invoices/${INVOICE_UUID}/actions/downloadPdf`)).toBe(true);
  });

  it("downloadPdf : adresse absente -> reponse_invalide", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: {} })]);
    const result = await requestInvoicePdfUrl(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });
});
