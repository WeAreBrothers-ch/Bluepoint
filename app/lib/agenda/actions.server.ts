import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { ensureInvoice } from "../factures/generate.server";
import type { InvoiceError } from "../factures/errors";
import { markOrderDelivered } from "../livraison/service.server";
import { loadStoredSettings } from "../reglages/settings.server";
import { parseGid, type OrderGid } from "../shopify/ids";
import { isAgendaIntent, type AgendaActionResult } from "./action-result";

/** Traitement serveur des actions de l'agenda. */

function invalidRequest(orderId: string): AgendaActionResult {
  return { ok: false, orderId, message: "Ça n’a pas marché. Rechargez la page, puis réessayez.", details: [], settingsLink: false };
}

function invoiceFailure(orderId: string, error: InvoiceError): AgendaActionResult {
  return {
    ok: false,
    orderId,
    message: error.message,
    details: error.details,
    settingsLink: error.code === "reglages_incomplets",
  };
}

async function generate(admin: AdminApiContext, shop: string, orderId: OrderGid): Promise<AgendaActionResult> {
  const result = await ensureInvoice(admin, shop, orderId);
  if (!result.ok) return invoiceFailure(orderId, result.error);
  const { invoice, created } = result.value;
  return {
    ok: true,
    orderId,
    message: created ? `Facture ${invoice.number} faite.` : `La facture ${invoice.number} était déjà faite.`,
    invoice: { id: invoice.id, number: invoice.number },
    warning: null,
    warningDetails: [],
    settingsLink: false,
  };
}

async function deliver(admin: AdminApiContext, shop: string, orderId: OrderGid): Promise<AgendaActionResult> {
  const settings = await loadStoredSettings(shop);
  const delivered = await markOrderDelivered(admin, orderId, { notifyCustomer: settings?.notifyCustomerOnDelivery ?? false });
  if (!delivered.ok) {
    logError("Livraison non notée", delivered.error, { orderId, detail: delivered.error.detail ?? null });
    return { ok: false, orderId, message: delivered.error.message, details: [], settingsLink: false };
  }
  const message = delivered.value.alreadyDelivered ? "Cette commande était déjà notée livrée." : "C’est noté\u202F: commande livrée.";
  const invoice = await ensureInvoice(admin, shop, orderId);
  if (invoice.ok) {
    const { number, id } = invoice.value.invoice;
    return { ok: true, orderId, message: `${message} La facture ${number} est prête.`, invoice: { id, number }, warning: null, warningDetails: [], settingsLink: false };
  }
  return {
    ok: true,
    orderId,
    message,
    invoice: null,
    warning: invoice.error.message,
    warningDetails: invoice.error.details,
    settingsLink: invoice.error.code === "reglages_incomplets",
  };
}

export async function handleAgendaAction(
  admin: AdminApiContext,
  shop: string,
  form: FormData,
): Promise<AgendaActionResult> {
  const rawOrderId = form.get("orderId");
  const intent = form.get("intent");
  const orderId = typeof rawOrderId === "string" ? parseGid(rawOrderId, "Order") : null;
  if (orderId === null || !isAgendaIntent(intent)) return invalidRequest(typeof rawOrderId === "string" ? rawOrderId : "");
  try {
    return intent === "livrer" ? await deliver(admin, shop, orderId) : await generate(admin, shop, orderId);
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Action de l'agenda impossible", error, { orderId, intent });
    return { ok: false, orderId, message: "Ça n’a pas marché. Réessayez dans un instant.", details: [], settingsLink: false };
  }
}
