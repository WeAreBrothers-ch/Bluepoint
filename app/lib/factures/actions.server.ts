import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { isFacturesIntent, type FacturesActionResult } from "./list-item";
import { parseEditedEmail } from "./message-input";
import { emailInvoice, recordWhatsappShare } from "./send.server";

/** Actions de la page Factures : envoi par e-mail (objet et message relus), envoi WhatsApp noté. */

async function sendEmail(admin: AdminApiContext, shop: string, invoiceId: string, form: FormData): Promise<FacturesActionResult> {
  const edited = parseEditedEmail(form.get("subject"), form.get("text"));
  if (!edited.ok) return { ok: false, invoiceId, message: edited.message, settingsLink: false };
  const sent = await emailInvoice(admin, shop, invoiceId, edited.value);
  return sent.ok
    ? { ok: true, invoiceId, message: `E-mail envoyé à ${sent.value}.` }
    : { ok: false, invoiceId, message: sent.error.message, settingsLink: sent.error.code === "reglages_incomplets" };
}

export async function handleFacturesAction(admin: AdminApiContext, shop: string, form: FormData): Promise<FacturesActionResult> {
  const invoiceId = form.get("invoiceId");
  const intent = form.get("intent");
  if (typeof invoiceId !== "string" || invoiceId === "" || !isFacturesIntent(intent)) {
    return { ok: false, invoiceId: "", message: "Demande invalide. Rechargez la page.", settingsLink: false };
  }
  try {
    if (intent === "email") return await sendEmail(admin, shop, invoiceId, form);
    const recorded = await recordWhatsappShare(shop, invoiceId);
    return recorded.ok
      ? { ok: true, invoiceId, message: "Envoi WhatsApp noté." }
      : { ok: false, invoiceId, message: recorded.error.message, settingsLink: false };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Action sur la facture impossible", error, { invoiceId, intent });
    return { ok: false, invoiceId, message: "Une erreur inattendue est survenue. Réessayez.", settingsLink: false };
  }
}
