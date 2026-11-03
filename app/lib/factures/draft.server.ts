import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { loadCompleteSettings } from "../reglages/settings.server";
import { isEmailConfigured } from "./email.server";
import { invoiceShareUrl } from "./links.server";
import { emailSubject, emailText, whatsappMessage } from "./messages";
import { getShopInvoice } from "./repository.server";
import { invoiceMessageData } from "./send.server";

/** Brouillons proposés dans les fenêtres d'envoi (e-mail et WhatsApp), à relire avant l'envoi. */

export interface InvoiceDrafts {
  readonly email: { readonly to: string; readonly subject: string; readonly text: string } | null;
  readonly whatsapp: { readonly phone: string; readonly text: string } | null;
}

export type InvoiceDraftsResult =
  | { readonly ok: true; readonly drafts: InvoiceDrafts }
  | { readonly ok: false; readonly message: string };

export async function loadInvoiceDrafts(
  admin: AdminApiContext,
  shop: string,
  invoiceId: string,
  now: Date,
): Promise<InvoiceDraftsResult> {
  try {
    const invoice = await getShopInvoice(shop, invoiceId);
    if (invoice === null) return { ok: false, message: "Facture introuvable. Rechargez la page." };
    const settings = await loadCompleteSettings(shop);
    if (settings === null) return { ok: false, message: "Complétez les réglages de facturation pour envoyer la facture." };
    const data = await invoiceMessageData(admin, invoice, settings.legalName);
    const canEmail = invoice.customerEmail !== null && isEmailConfigured();
    return {
      ok: true,
      drafts: {
        email: canEmail && invoice.customerEmail !== null
          ? { to: invoice.customerEmail, subject: emailSubject(data), text: emailText(data) }
          : null,
        whatsapp: invoice.customerPhone === null
          ? null
          : { phone: invoice.customerPhone, text: whatsappMessage(data, invoiceShareUrl(invoice.id, now)) },
      },
    };
  } catch (error) {
    logError("Brouillon de message de facture impossible", error, { invoiceId });
    return { ok: false, message: "Le message n’a pas pu être préparé. Fermez et réessayez." };
  }
}
