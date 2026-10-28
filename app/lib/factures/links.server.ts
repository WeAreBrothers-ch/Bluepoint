import { readRequiredEnv } from "../core/env.server";
import { createShareToken, verifyShareToken, type ShareTokenCheck } from "./share-token";

/** Liens publics signés vers le PDF d'une facture (route app/routes/partage.$token.tsx). */

function appUrl(): string {
  return readRequiredEnv("SHOPIFY_APP_URL").replace(/\/+$/, "");
}

export function invoiceShareUrl(invoiceId: string, now: Date = new Date()): string {
  const token = createShareToken(invoiceId, readRequiredEnv("SHOPIFY_API_SECRET"), now);
  return `${appUrl()}/partage/${token}`;
}

export function checkShareToken(token: string, now: Date = new Date()): ShareTokenCheck {
  return verifyShareToken(token, readRequiredEnv("SHOPIFY_API_SECRET"), now);
}
