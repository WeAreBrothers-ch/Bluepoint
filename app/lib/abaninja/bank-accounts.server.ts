import { failure, success, type Result } from "../core/result";
import type { CallOptions } from "./call-options";
import type { AbaNinjaConfig } from "./config.server";
import { AbaNinjaError } from "./errors";
import { abaNinjaRequest } from "./http.server";
import { bankAccountsResponseSchema, type BankAccountRecord } from "./schemas";

/** Comptes bancaires AbaNinja : on cherche celui qui porte la QR-facture. */

export interface QrBankAccount {
  readonly uuid: string;
  readonly name: string | null;
}

export async function listBankAccounts(
  config: AbaNinjaConfig,
  options: CallOptions = {},
): Promise<Result<readonly BankAccountRecord[], AbaNinjaError>> {
  const result = await abaNinjaRequest({
    ...options,
    config,
    method: "GET",
    path: ["accounts", { uuid: config.accountUuid }, "finances", "v2", "bank-accounts"],
    schema: bankAccountsResponseSchema,
  });
  return result.ok ? success(result.value.data) : result;
}

function hasQrIban(account: BankAccountRecord): boolean {
  return account.isActive && account.qrBill?.active === true && (account.qrBill.qrIban ?? "").trim() !== "";
}

function misconfigured(message: string): Result<never, AbaNinjaError> {
  return failure(new AbaNinjaError("non_configure", { message }));
}

function toQrAccount(account: BankAccountRecord): Result<QrBankAccount, AbaNinjaError> {
  return success({ uuid: account.uuid, name: account.name ?? null });
}

/**
 * Choisit le compte pour la QR-facture : actif, QR-facture activée et QR-IBAN
 * renseigné. Le compte par défaut est préféré ; sans lui, plusieurs candidats
 * donnent un échec explicite plutôt qu'un choix au hasard.
 */
export function pickQrBankAccount(accounts: readonly BankAccountRecord[]): Result<QrBankAccount, AbaNinjaError> {
  const candidates = accounts.filter(hasQrIban);
  const [first, second] = candidates;
  if (first === undefined) {
    return misconfigured(
      "Aucun compte bancaire AbaNinja n'est prêt pour la QR-facture : activez la QR-facture et saisissez le QR-IBAN sur un compte actif.",
    );
  }
  const defaults = candidates.filter((account) => account.isDefault);
  if (defaults.length === 1 && defaults[0] !== undefined) return toQrAccount(defaults[0]);
  if (defaults.length > 1) {
    return misconfigured("Plusieurs comptes bancaires par défaut avec QR-facture : choix ambigu, corrigez-le dans AbaNinja.");
  }
  if (second === undefined) return toQrAccount(first);
  return misconfigured(
    "Plusieurs comptes bancaires AbaNinja peuvent porter la QR-facture : choix ambigu, définissez-en un par défaut dans AbaNinja.",
  );
}

/** Liste les comptes puis choisit celui de la QR-facture. */
export async function findQrBankAccount(
  config: AbaNinjaConfig,
  options: CallOptions = {},
): Promise<Result<QrBankAccount, AbaNinjaError>> {
  const accounts = await listBankAccounts(config, options);
  return accounts.ok ? pickQrBankAccount(accounts.value) : accounts;
}
