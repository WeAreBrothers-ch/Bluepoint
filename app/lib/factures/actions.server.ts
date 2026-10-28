import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { isFacturesIntent, type FacturesActionResult } from "./list-item";
import { isPaymentMethod, PAYMENT_METHOD_LABELS } from "./payment";
import { loadPaymentStatuses, markOrderPaid } from "./payment.server";
import { getShopInvoice } from "./repository.server";
import { emailInvoice, recordWhatsappShare } from "./send.server";

/** Actions sur une facture : envoi par e-mail, envoi WhatsApp, relance par e-mail, « Le client a payé ». */

function failed(invoiceId: string, message: string, settingsLink = false): FacturesActionResult {
  return { ok: false, invoiceId, message, settingsLink };
}

async function alreadyPaid(admin: AdminApiContext, orderId: string): Promise<boolean> {
  const statuses = await loadPaymentStatuses(admin, [orderId]);
  return statuses.ok && statuses.value.get(orderId) === "PAID";
}

async function markPaid(admin: AdminApiContext, shop: string, invoiceId: string, method: unknown): Promise<FacturesActionResult> {
  if (!isPaymentMethod(method)) return failed(invoiceId, "Choisissez comment le client a payé.");
  const invoice = await getShopInvoice(shop, invoiceId);
  if (invoice === null) return failed(invoiceId, "Cette facture n’existe plus.");
  const paid = await markOrderPaid(admin, invoice.orderId, method);
  // Deux personnes touchent « Le client a payé » en même temps : Shopify refuse la seconde, mais c'est bien payé.
  if (!paid.ok && !(await alreadyPaid(admin, invoice.orderId))) {
    logError("Paiement non enregistré dans Shopify", paid.error, { invoiceId });
    return failed(invoiceId, "Le paiement n’a pas pu être noté dans Shopify. Réessayez dans un instant.");
  }
  return { ok: true, invoiceId, message: `C’est noté\u202F: facture ${invoice.number} payée (${PAYMENT_METHOD_LABELS[method]}).` };
}

export async function handleFacturesAction(admin: AdminApiContext, shop: string, form: FormData): Promise<FacturesActionResult> {
  const invoiceId = form.get("invoiceId");
  const intent = form.get("intent");
  if (typeof invoiceId !== "string" || invoiceId === "" || !isFacturesIntent(intent)) {
    return failed("", "Ça n’a pas marché. Rechargez la page, puis réessayez.");
  }
  try {
    if (intent === "payee") return await markPaid(admin, shop, invoiceId, form.get("method"));
    if (intent === "email" || intent === "relance_email") {
      const sent = await emailInvoice(shop, invoiceId, intent === "email" ? "facture" : "relance");
      if (!sent.ok) return failed(invoiceId, sent.error.message, sent.error.code === "reglages_incomplets");
      return { ok: true, invoiceId, message: intent === "email" ? `Facture envoyée à ${sent.value}.` : `Rappel envoyé à ${sent.value}.` };
    }
    const recorded = await recordWhatsappShare(shop, invoiceId);
    return recorded.ok
      ? { ok: true, invoiceId, message: "WhatsApp est ouvert\u202F: touchez « Envoyer » dans WhatsApp pour que la facture parte." }
      : failed(invoiceId, recorded.error.message);
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Action sur la facture impossible", error, { invoiceId, intent });
    return failed(invoiceId, "Ça n’a pas marché. Réessayez dans un instant.");
  }
}
