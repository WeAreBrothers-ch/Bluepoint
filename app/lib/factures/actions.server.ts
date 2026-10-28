import { logError } from "../core/logger.server";
import { isFacturesIntent, type FacturesActionResult } from "./list-item";
import { emailInvoice, recordWhatsappShare } from "./send.server";

/** Actions de la page Factures : envoi par e-mail, envoi WhatsApp enregistré. */

export async function handleFacturesAction(shop: string, form: FormData): Promise<FacturesActionResult> {
  const invoiceId = form.get("invoiceId");
  const intent = form.get("intent");
  if (typeof invoiceId !== "string" || invoiceId === "" || !isFacturesIntent(intent)) {
    return { ok: false, invoiceId: "", message: "Demande invalide. Rechargez la page.", settingsLink: false };
  }
  try {
    if (intent === "email") {
      const sent = await emailInvoice(shop, invoiceId);
      return sent.ok
        ? { ok: true, invoiceId, message: `Facture envoyée à ${sent.value}.` }
        : { ok: false, invoiceId, message: sent.error.message, settingsLink: sent.error.code === "reglages_incomplets" };
    }
    const recorded = await recordWhatsappShare(shop, invoiceId);
    return recorded.ok
      ? { ok: true, invoiceId, message: "Envoi WhatsApp noté." }
      : { ok: false, invoiceId, message: recorded.error.message, settingsLink: false };
  } catch (error) {
    logError("Action sur la facture impossible", error, { invoiceId, intent });
    return { ok: false, invoiceId, message: "Une erreur inattendue est survenue. Réessayez.", settingsLink: false };
  }
}
