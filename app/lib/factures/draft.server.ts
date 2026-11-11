import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { loadCompleteSettings } from "../reglages/settings.server";
import { isEmailConfigured } from "./email.server";
import { invoiceShareUrl } from "./links.server";
import { emailSubject, emailText, whatsappMessage } from "./messages";
import { getShopInvoice } from "./repository.server";
import { invoiceMessageData } from "./send.server";

/** Brouillons proposés dans les fenêtres d'envoi (e-mail et WhatsApp), à relire avant l'envoi. */

/**
 * `auto` : l'app envoie l'e-mail elle-même, PDF joint. `messagerie` : l'envoi automatique n'est pas configuré,
 * l'e-mail s'écrit dans la messagerie de l'équipe et porte le lien du PDF.
 */
export interface EmailDraft {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly mode: "auto" | "messagerie";
}

export interface InvoiceDrafts {
  readonly email: EmailDraft | null;
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
    if (settings === null) return { ok: false, message: "Complétez d’abord « Informations de l’entreprise » pour envoyer la facture." };
    const data = await invoiceMessageData(admin, invoice, settings.legalName);
    const auto = isEmailConfigured();
    return {
      ok: true,
      drafts: {
        email: invoice.customerEmail === null
          ? null
          : {
              to: invoice.customerEmail,
              subject: emailSubject(data),
              text: emailText(data, auto ? null : invoiceShareUrl(invoice.id, now)),
              mode: auto ? "auto" : "messagerie",
            },
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
