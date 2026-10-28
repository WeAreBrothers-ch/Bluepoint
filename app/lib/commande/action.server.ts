import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { logError } from "../core/logger.server";
import { loadStoredSettings } from "../reglages/settings.server";
import { createPhoneOrder } from "./create.server";
import { MESSAGES, type PhoneOrderOutcome } from "./outcome";
import { buildCalculationInput } from "./payload";
import type { PriceCalculationResult } from "./pricing";
import { parsePhoneOrder, parsePriceCalculation } from "./schema";
import { calculateDraftPrices } from "./writes.server";

/** Actions de la page « Prendre une commande » : prix du client, enregistrement de la commande. */

/** Délai par défaut si les réglages de facturation ne sont pas encore enregistrés. */
export const DEFAULT_PAYMENT_TERM_DAYS = 30;

export type CommandeActionResult =
  | { readonly intent: "creer"; readonly outcome: PhoneOrderOutcome }
  /** `signature` : renvoyée telle quelle, pour que la page sache à quelle saisie ces prix répondent. */
  | { readonly intent: "calculer"; readonly signature: string; readonly result: PriceCalculationResult };

type JsonRecord = Readonly<Record<string, unknown>>;

async function readJson(request: Request): Promise<JsonRecord | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as JsonRecord) : null;
  } catch {
    return null;
  }
}

export async function paymentTermDaysFor(shop: string): Promise<number> {
  try {
    const settings = await loadStoredSettings(shop);
    return settings?.paymentTermDays ?? DEFAULT_PAYMENT_TERM_DAYS;
  } catch (error) {
    logError("Délai de paiement illisible, délai par défaut utilisé", error, { shop });
    return DEFAULT_PAYMENT_TERM_DAYS;
  }
}

const MAX_SIGNATURE_LENGTH = 20000;

function readSignature(body: JsonRecord): string {
  const signature = body["signature"];
  return typeof signature === "string" && signature.length <= MAX_SIGNATURE_LENGTH ? signature : "";
}

async function calculate(admin: AdminApiContext, body: JsonRecord): Promise<CommandeActionResult> {
  const signature = readSignature(body);
  const input = parsePriceCalculation(body);
  if (input === null) return { intent: "calculer", signature, result: { ok: false, message: "Prix non calculés." } };
  const prices = await calculateDraftPrices(admin, buildCalculationInput(input.customerId, input.b2b, input.lines));
  if (prices.ok) return { intent: "calculer", signature, result: { ok: true, prices: prices.value } };
  logError("Prix du client non calculés", prices.error);
  return {
    intent: "calculer",
    signature,
    result: { ok: false, message: "Prix du client non calculés\u202F: les prix affichés sont les prix normaux." },
  };
}

async function create(admin: AdminApiContext, shop: string, body: JsonRecord): Promise<CommandeActionResult> {
  const parsed = parsePhoneOrder(body, swissIsoDate(new Date()));
  if (!parsed.ok) return { intent: "creer", outcome: { kind: "invalide", message: MESSAGES.invalide, errors: parsed.errors } };
  try {
    const outcome = await createPhoneOrder(admin, shop, parsed.value, await paymentTermDaysFor(shop));
    return { intent: "creer", outcome };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Création de la commande par téléphone impossible", error, { shop });
    return { intent: "creer", outcome: { kind: "erreur", message: MESSAGES.base } };
  }
}

export async function handleCommandeAction(
  admin: AdminApiContext,
  shop: string,
  request: Request,
): Promise<CommandeActionResult> {
  const body = await readJson(request);
  if (body?.["intent"] === "calculer") return calculate(admin, body);
  if (body?.["intent"] === "creer") return create(admin, shop, body);
  return { intent: "creer", outcome: { kind: "erreur", message: MESSAGES.recharger } };
}
