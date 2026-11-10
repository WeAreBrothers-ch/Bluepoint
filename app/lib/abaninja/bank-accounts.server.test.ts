import { describe, expect, it, vi } from "vitest";
import { findQrBankAccount, listBankAccounts, pickQrBankAccount } from "./bank-accounts.server";
import type { BankAccountRecord } from "./schemas";
import { emptyResponse, jsonResponse, scriptedFetch, TEST_ACCOUNT_UUID, testConfig } from "./test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function account(uuid: string, extra: Partial<BankAccountRecord> = {}): BankAccountRecord {
  return { uuid, name: "Compte", isActive: true, isDefault: false, qrBill: { active: true, qrIban: "CH4431999123000889012" }, ...extra };
}

describe("pickQrBankAccount", () => {
  it("choisit l'unique compte prêt", () => {
    const result = pickQrBankAccount([account(UUID_A), account(UUID_B, { isActive: false })]);
    expect(result).toEqual({ ok: true, value: { uuid: UUID_A, name: "Compte" } });
  });

  it("préfère le compte par défaut", () => {
    const result = pickQrBankAccount([account(UUID_A), account(UUID_B, { isDefault: true })]);
    expect(result.ok && result.value.uuid).toBe(UUID_B);
  });

  it("échoue explicitement quand plusieurs candidats non par défaut", () => {
    const result = pickQrBankAccount([account(UUID_A), account(UUID_B)]);
    expect(!result.ok && result.error.message).toContain("ambigu");
  });

  it("échoue quand deux comptes sont par défaut", () => {
    const result = pickQrBankAccount([account(UUID_A, { isDefault: true }), account(UUID_B, { isDefault: true })]);
    expect(!result.ok && result.error.message).toContain("ambigu");
  });

  it.each([
    ["inactif", { isActive: false }],
    ["QR-facture désactivée", { qrBill: { active: false, qrIban: "CH44" } }],
    ["QR-IBAN absent", { qrBill: { active: true, qrIban: null } }],
    ["QR-IBAN vide", { qrBill: { active: true, qrIban: "  " } }],
    ["sans bloc qrBill", { qrBill: null }],
  ] as const)("ignore un compte %s", (_label, extra) => {
    const result = pickQrBankAccount([account(UUID_A, extra)]);
    expect(!result.ok && result.error.code).toBe("non_configure");
    expect(!result.ok && result.error.message).toContain("QR-facture");
  });

  it("échoue clairement sans aucun compte", () => {
    expect(pickQrBankAccount([]).ok).toBe(false);
  });
});

describe("listBankAccounts / findQrBankAccount", () => {
  it("appelle le bon chemin et lit la liste", async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ data: [account(UUID_A, { isDefault: true })] })]);
    const result = await findQrBankAccount(testConfig(), { fetchImpl });
    expect(result.ok && result.value.uuid).toBe(UUID_A);
    expect(calls[0]?.url).toBe(`https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/finances/v2/bank-accounts`);
  });

  it("tolère les champs inconnus mais refuse un uuid invalide", async () => {
    const good = scriptedFetch([jsonResponse({ data: [{ ...account(UUID_A), inconnu: 1 }] })]);
    expect((await listBankAccounts(testConfig(), { fetchImpl: good.fetchImpl })).ok).toBe(true);
    const bad = scriptedFetch([jsonResponse({ data: [{ ...account(UUID_A), uuid: "pas-un-uuid" }] })]);
    const result = await listBankAccounts(testConfig(), { fetchImpl: bad.fetchImpl });
    expect(!result.ok && result.error.code).toBe("reponse_invalide");
  });

  it.each([
    [401, "non_autorise"],
    [403, "non_autorise"],
    [404, "introuvable"],
    [500, "indisponible"],
  ] as const)("statut %i -> %s", async (status, code) => {
    const { fetchImpl } = scriptedFetch([emptyResponse(status)]);
    const result = await listBankAccounts(testConfig(), { fetchImpl, sleep: () => Promise.resolve() });
    expect(!result.ok && result.error.code).toBe(code);
  });
});
