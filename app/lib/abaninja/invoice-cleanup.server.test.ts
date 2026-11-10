import { describe, expect, it } from "vitest";
import { deleteCompany, deleteInvoice } from "./invoice-cleanup.server";
import { emptyResponse, jsonResponse, OTHER_UUID, scriptedFetch, testConfig } from "./test-support";

describe("deleteInvoice", () => {
  it("réussit sur un 204 et utilise PATCH .../actions/delete", async () => {
    const { fetchImpl, calls } = scriptedFetch([emptyResponse(204)]);
    const result = await deleteInvoice(testConfig(), OTHER_UUID, { fetchImpl, sleep: () => Promise.resolve() });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(calls[0]?.url.endsWith(`/invoices/${OTHER_UUID}/actions/delete`)).toBe(true);
  });

  it("garde le 404 comme erreur « introuvable » (l'appelant décide)", async () => {
    const { fetchImpl } = scriptedFetch([emptyResponse(404)]);
    const result = await deleteInvoice(testConfig(), OTHER_UUID, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("introuvable");
    expect(!result.ok && result.error.status).toBe(404);
  });
});

describe("deleteCompany", () => {
  it("réussit sur un 200", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({})]);
    const result = await deleteCompany(testConfig(), OTHER_UUID, { fetchImpl });
    expect(result.ok).toBe(true);
    expect(calls[0]?.init.method).toBe("DELETE");
  });

  it("garde le 404 comme erreur « introuvable »", async () => {
    const { fetchImpl } = scriptedFetch([emptyResponse(404)]);
    const result = await deleteCompany(testConfig(), OTHER_UUID, { fetchImpl });
    expect(!result.ok && result.error.code).toBe("introuvable");
  });

  it("garde le 409 (client encore utilisé)", async () => {
    const { fetchImpl } = scriptedFetch([emptyResponse(409)]);
    const result = await deleteCompany(testConfig(), OTHER_UUID, { fetchImpl });
    expect(!result.ok && result.error.status).toBe(409);
  });
});
