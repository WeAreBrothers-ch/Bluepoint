import { createTransport } from "nodemailer";
import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import { readOptionalEnv } from "../core/env.server";
import { InvoiceError } from "./errors";

/**
 * Envoi par e-mail depuis une boîte Infomaniak de BluePoint (SMTP), sans service tiers.
 * Le domaine bluepointdistribution.com est chez Infomaniak et son SPF autorise déjà leurs serveurs.
 * - SMTP_USER : adresse complète de la boîte d'envoi (ex. factures@bluepointdistribution.com)
 * - SMTP_PASSWORD : son mot de passe (ou mot de passe d'application si la double authentification est active)
 * - EMAIL_FROM_NAME (facultatif) : nom affiché, « Blue Point Distribution » par défaut
 * - SMTP_HOST / SMTP_PORT (facultatifs) : serveur Infomaniak par défaut, connexion chiffrée (465)
 * L'expéditeur est toujours la boîte elle-même : Infomaniak refuse un autre expéditeur.
 */

const DEFAULT_HOST = "mail.infomaniak.com";
const DEFAULT_PORT = 465;
const DEFAULT_FROM_NAME = "Blue Point Distribution";
const TIMEOUT_MS = 15_000;

interface EmailConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly fromName: string;
}

function readPort(): number {
  const port = Number(readOptionalEnv("SMTP_PORT") ?? DEFAULT_PORT);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

export function emailConfig(): EmailConfig | null {
  const user = readOptionalEnv("SMTP_USER");
  const password = readOptionalEnv("SMTP_PASSWORD");
  if (user === undefined || password === undefined) return null;
  return {
    host: readOptionalEnv("SMTP_HOST") ?? DEFAULT_HOST,
    port: readPort(),
    user: user.trim(),
    password,
    fromName: readOptionalEnv("EMAIL_FROM_NAME") ?? DEFAULT_FROM_NAME,
  };
}

export function isEmailConfigured(): boolean {
  return emailConfig() !== null;
}

export interface InvoiceEmail {
  readonly to: string;
  readonly replyTo: string;
  readonly subject: string;
  readonly text: string;
  readonly fileName: string;
  readonly pdf: Uint8Array;
}

function createMailer(config: EmailConfig) {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: true,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

export async function sendInvoiceEmail(email: InvoiceEmail): Promise<Result<true, InvoiceError>> {
  const config = emailConfig();
  if (config === null) return failure(new InvoiceError("envoi_non_configure"));
  const mailer = createMailer(config);
  try {
    await mailer.sendMail({
      from: { name: config.fromName, address: config.user },
      to: email.to,
      replyTo: email.replyTo,
      subject: email.subject,
      text: email.text,
      attachments: [
        { filename: email.fileName, content: Buffer.from(email.pdf), contentType: "application/pdf" },
      ],
    });
    return success(true);
  } catch (error) {
    logError("Envoi de l'e-mail impossible (SMTP Infomaniak)", error, { host: config.host, port: config.port });
    return failure(new InvoiceError("envoi_echoue", [detailFor(error)]));
  } finally {
    mailer.close();
  }
}

/** Explication lisible pour l'équipe, sans détail technique ni secret. */
function detailFor(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "EAUTH") return "La boîte d’envoi a refusé la connexion : vérifiez l’adresse et le mot de passe dans les réglages Vercel.";
  if (code === "ETIMEDOUT" || code === "ECONNECTION") return "Le serveur d’e-mail ne répond pas. Réessayez dans un instant.";
  return "Le serveur d’e-mail a refusé l’envoi. Réessayez dans un instant.";
}
