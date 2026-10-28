import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lien public signé vers le PDF d'une facture (pour WhatsApp) : HMAC-SHA256 avec le secret
 * de l'app, valable 14 jours. Le jeton contient l'identifiant de la facture et l'échéance ;
 * toute modification invalide la signature.
 */

export const SHARE_LINK_TTL_DAYS = 14;
const DAY_IN_SECONDS = 86_400;
const PURPOSE = "facture-pdf";

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${PURPOSE}:${payload}`).digest("base64url");
}

export function createShareToken(invoiceId: string, secret: string, now: Date, ttlDays = SHARE_LINK_TTL_DAYS): string {
  const expires = Math.floor(now.getTime() / 1000) + ttlDays * DAY_IN_SECONDS;
  const payload = base64url(`${invoiceId}.${expires}`);
  return `${payload}.${sign(payload, secret)}`;
}

export type ShareTokenCheck =
  | { readonly ok: true; readonly invoiceId: string; readonly expiresAt: Date }
  | { readonly ok: false; readonly reason: "invalide" | "expire" };

function sameSignature(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyShareToken(token: string, secret: string, now: Date): ShareTokenCheck {
  const [payload, signature, extra] = token.split(".");
  if (payload === undefined || signature === undefined || extra !== undefined) return { ok: false, reason: "invalide" };
  if (!sameSignature(sign(payload, secret), signature)) return { ok: false, reason: "invalide" };
  const match = /^([A-Za-z0-9_-]{1,64})\.(\d{1,12})$/.exec(Buffer.from(payload, "base64url").toString("utf8"));
  if (match === null) return { ok: false, reason: "invalide" };
  const [, invoiceId = "", expires = "0"] = match;
  const expiresAt = new Date(Number(expires) * 1000);
  return expiresAt.getTime() <= now.getTime() ? { ok: false, reason: "expire" } : { ok: true, invoiceId, expiresAt };
}
