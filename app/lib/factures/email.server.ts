import { failure, success, type Result } from "../core/result";
import { logError } from "../core/logger.server";
import { readOptionalEnv } from "../core/env.server";
import { InvoiceError } from "./errors";

/**
 * Envoi par e-mail via l'API REST de Resend (https://resend.com/docs/api-reference/emails/send-email).
 * RESEND_API_KEY : clé secrète ; RESEND_FROM : expéditeur d'un domaine vérifié chez Resend,
 * ex. « Blue Point Distribution <factures@bluepointdistribution.com> ».
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

interface EmailConfig {
  readonly apiKey: string;
  readonly from: string;
}

export function emailConfig(): EmailConfig | null {
  const apiKey = readOptionalEnv("RESEND_API_KEY");
  const from = readOptionalEnv("RESEND_FROM");
  return apiKey === undefined || from === undefined ? null : { apiKey, from };
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

export async function sendInvoiceEmail(email: InvoiceEmail): Promise<Result<true, InvoiceError>> {
  const config = emailConfig();
  if (config === null) return failure(new InvoiceError("envoi_non_configure"));
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        attachments: [{ filename: email.fileName, content: Buffer.from(email.pdf).toString("base64") }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) return success(true);
    logError("Resend a refusé l'e-mail", new Error(`HTTP ${response.status}`), { status: response.status });
    return failure(new InvoiceError("envoi_echoue", [`Le service d’envoi a répondu ${response.status}.`]));
  } catch (error) {
    logError("Envoi de l'e-mail impossible", error);
    return failure(new InvoiceError("envoi_echoue"));
  }
}
