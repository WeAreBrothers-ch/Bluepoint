import { describe, expect, it, vi } from "vitest";
import { listInvoiceActionNames, requestDraftPreviewUrl } from "./invoice-preview.server";
import { downloadDraftInvoicePdf } from "./pdf-download.server";
import { jsonResponse, OTHER_UUID, scriptedFetch, TEST_ACCOUNT_UUID, testConfig } from "./test-support";
import { trialInvoice } from "./trial-fixtures";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const INVOICE_UUID = "44444444-4444-4444-8444-444444444444";
const ADDRESS_UUID = "55555555-5555-4555-8555-555555555555";
const INPUT = trialInvoice({ addressUuid: ADDRESS_UUID, companyUuid: OTHER_UUID }, OTHER_UUID, "BP-ESSAI-1", new Date("2026-11-12T10:00:00Z"));
const PREVIEW_PATH = `https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/documents/v2/invoices/${INVOICE_UUID}/preview`;

describe("requestDraftPreviewUrl", () => {
  it("demande l'aperçu en POST avec le contenu de la facture, jamais downloadPdf", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: { downloadUrl: "https://api.abaninja.ch/p/1" } }, 201)]);
    const result = await requestDraftPreviewUrl(testConfig(), INVOICE_UUID, INPUT, { fetchImpl });
    expect(result).toEqual({ ok: true, value: "https://api.abaninja.ch/p/1" });
    expect(calls[0]?.url).toBe(PREVIEW_PATH);
    expect(calls[0]?.init.method).toBe("POST");
    const body = JSON.parse(String(calls[0]?.init.body)) as { documents: unknown[] };
    expect(body.documents).toHaveLength(1);
  });

  it("se rabat sur previewUrl quand downloadUrl manque", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: { previewUrl: "https://api.abaninja.ch/p/2" } }, 201)]);
    const result = await requestDraftPreviewUrl(testConfig(), INVOICE_UUID, INPUT, { fetchImpl });
    expect(result).toEqual({ ok: true, value: "https://api.abaninja.ch/p/2" });
  });

  it("aucune adresse dans la réponse : reponse_invalide", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: {} }, 201)]);
    const result = await requestDraftPreviewUrl(testConfig(), INVOICE_UUID, INPUT, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });

  it("contenu invalide : rien n'est envoyé", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: {} })]);
    const result = await requestDraftPreviewUrl(testConfig(), INVOICE_UUID, { ...INPUT, positions: [] }, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("downloadDraftInvoicePdf", () => {
  it("télécharge le PDF de l'aperçu, avec les mêmes contrôles que downloadPdf", async () => {
    const pdf = new Response(new TextEncoder().encode("%PDF-1.7 apercu"), { status: 200 });
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: { downloadUrl: "https://api.abaninja.ch/p/1" } }, 201), pdf]);
    const result = await downloadDraftInvoicePdf(testConfig(), INVOICE_UUID, INPUT, { fetchImpl });
    expect(result.ok && new TextDecoder().decode(result.value)).toBe("%PDF-1.7 apercu");
    expect(calls[1]?.url).toBe("https://api.abaninja.ch/p/1");
  });

  it("refuse une adresse hors abaninja.ch sans l'appeler", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: { downloadUrl: "https://evil.example/x.pdf" } }, 201)]);
    const result = await downloadDraftInvoicePdf(testConfig(), INVOICE_UUID, INPUT, { fetchImpl });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe("listInvoiceActionNames", () => {
  it("lit les noms d'un objet { action: libellé }", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: { delete: "Supprimer", markSent: "Envoyé" } })]);
    const result = await listInvoiceActionNames(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result).toEqual({ ok: true, value: ["delete", "markSent"] });
    expect(calls[0]?.url.endsWith(`/invoices/${INVOICE_UUID}/actions`)).toBe(true);
  });

  it("lit une liste de noms ou d'objets { name }", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: ["print", { name: "delete" }, { action: "clone" }, 3] })]);
    const result = await listInvoiceActionNames(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result).toEqual({ ok: true, value: ["print", "delete", "clone"] });
  });

  it("neutralise les caractères inattendus dans les noms", async () => {
    const { fetchImpl } = scriptedFetch([jsonResponse({ data: ["mark <Sent>"] })]);
    const result = await listInvoiceActionNames(testConfig(), INVOICE_UUID, { fetchImpl });
    expect(result).toEqual({ ok: true, value: ["mark??Sent?"] });
  });
});
