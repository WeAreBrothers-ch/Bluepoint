import type { CallOptions } from "./call-options";
import { readAbaNinjaConfig, type AbaNinjaConfig } from "./config.server";
import { findQrBankAccount } from "./bank-accounts.server";
import type { TrialLog } from "./trial-types";

/** Étapes 1 et 2 : les accès sont là, et un compte bancaire peut porter la QR-facture. */

const CONFIG_HELP =
  " Demandez à la personne qui s’occupe de l’application de corriger ABANINJA_TOKEN et ABANINJA_ACCOUNT_UUID (dans Vercel), puis relancez l’essai.";

const QR_HELP =
  " Dans AbaNinja, ouvrez les réglages de votre compte bancaire, activez la QR-facture et saisissez le QR-IBAN donné par votre banque.";

export function checkConfiguration(
  log: TrialLog,
  env: Readonly<Record<string, string | undefined>>,
): AbaNinjaConfig | null {
  const config = readAbaNinjaConfig(env);
  if (!config.ok) {
    // Le message de l'erreur dit précisément ce qui ne va pas, sans jamais citer la valeur.
    log.fail("configuration", `${config.error.message}${CONFIG_HELP}`);
    return null;
  }
  log.ok("configuration", "Le jeton et l’identifiant de compte sont présents et bien formés.");
  return config.value;
}

/** Renvoie l'identifiant du compte bancaire à utiliser sur la facture d'essai. */
export async function checkBankAccount(log: TrialLog, config: AbaNinjaConfig, call: CallOptions): Promise<string | null> {
  const account = await findQrBankAccount(config, call);
  if (!account.ok) {
    const help = account.error.code === "non_configure" ? QR_HELP : "";
    log.fail("comptes", `${account.error.message}${help}`);
    return null;
  }
  log.ok("comptes", "Un compte bancaire actif avec la QR-facture a été trouvé.");
  return account.value.uuid;
}
