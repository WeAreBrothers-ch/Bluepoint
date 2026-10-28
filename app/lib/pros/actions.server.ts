import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { findPaymentTemplate } from "../commande/reads.server";
import { logError, logInfo } from "../core/logger.server";
import { loadStoredSettings } from "../reglages/settings.server";
import {
  getProRequest,
  markProRequestAccepted,
  markProRequestRefused,
  rememberCompany,
  saveProRequest,
} from "./repository.server";
import { parseProRequest, readProRequestForm, type ProRequestInput } from "./request";
import { makePro } from "./shopify.server";
import { isProsIntent, type ProsActionResult } from "./view";

/** Actions de la page « Clients pro » : accepter, refuser une demande, ajouter un pro directement. */

const DEFAULT_TERM_DAYS = 30;

function failed(intent: ProsActionResult["intent"], requestId: string | null, message: string): ProsActionResult {
  return { ok: false, intent, requestId, message };
}

function successMessage(input: ProRequestInput, alreadyPro: boolean, invited: boolean): string {
  if (alreadyPro) return `${input.firstName} ${input.lastName} était déjà rattaché(e) à une entreprise\u202F: l’étiquette « pro » est en place.`;
  const invitation = invited
    ? ` Shopify lui a envoyé un e-mail d’invitation à ${input.email}.`
    : " L’e-mail d’invitation n’a pas pu partir\u202F: la personne peut quand même se connecter au site avec son adresse e-mail.";
  return `C’est fait\u202F: ${input.companyName} est client pro (prix pros et paiement à 30 jours).${invitation}`;
}

/** Crée le compte pro dans Shopify pour une demande enregistrée, puis la marque acceptée. */
async function acceptRequest(admin: AdminApiContext, shop: string, requestId: string, intent: "accepter" | "ajouter"): Promise<ProsActionResult> {
  const request = await getProRequest(shop, requestId);
  if (request === null) return failed(intent, requestId, "Cette demande n’existe plus. Rechargez la page.");
  if (request.status !== "en_attente") return failed(intent, requestId, "Cette demande a déjà reçu une réponse. Rechargez la page.");
  const parsed = parseProRequest({
    companyName: request.companyName,
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    phone: request.phone,
    street: request.street,
    postalCode: request.postalCode,
    city: request.city,
    country: request.country,
    vatNumber: request.vatNumber ?? "",
    message: request.message ?? "",
  });
  if (!parsed.ok) return failed(intent, requestId, "Cette demande contient une information illisible. Refusez-la et ajoutez le client pro à la main.");

  const settings = await loadStoredSettings(shop);
  const template = await findPaymentTemplate(admin, "facture", settings?.paymentTermDays ?? DEFAULT_TERM_DAYS);
  const made = await makePro(admin, parsed.value, {
    existingCompanyId: request.companyId,
    paymentTermsTemplateId: template?.template.id ?? null,
    onCompanyCreated: (companyId) => rememberCompany(request.id, companyId),
  });
  if (!made.ok) return failed(intent, requestId, made.error.message);
  await markProRequestAccepted(request.id, made.value.companyId, made.value.customerId);
  logInfo("Demande de compte pro acceptée", { requestId, companyId: made.value.companyId });
  const terms = template === null ? " Le paiement à 30 jours reste à régler dans Shopify (fiche de l’entreprise)." : "";
  return { ok: true, intent, requestId, message: `${successMessage(parsed.value, made.value.alreadyPro, made.value.invited)}${terms}` };
}

export async function handleProsAction(admin: AdminApiContext, shop: string, form: FormData): Promise<ProsActionResult> {
  const intent = form.get("intent");
  const rawId = form.get("requestId");
  const requestId = typeof rawId === "string" && rawId !== "" ? rawId : null;
  if (!isProsIntent(intent)) return failed(null, requestId, "Ça n’a pas marché. Rechargez la page, puis réessayez.");
  try {
    if (intent === "ajouter") {
      const parsed = parseProRequest(readProRequestForm(form));
      if (!parsed.ok) {
        return { ok: false, intent, requestId: null, message: "Certaines cases sont à corriger (en rouge).", errors: parsed.errors, values: parsed.values };
      }
      const saved = await saveProRequest(shop, parsed.value, "app");
      if (!saved.ok) return failed(intent, null, "Ça n’a pas marché. Réessayez dans un instant.");
      return await acceptRequest(admin, shop, saved.id, intent);
    }
    if (requestId === null) return failed(intent, null, "Ça n’a pas marché. Rechargez la page, puis réessayez.");
    if (intent === "accepter") return await acceptRequest(admin, shop, requestId, intent);
    const request = await getProRequest(shop, requestId);
    if (request === null || request.status !== "en_attente") return failed(intent, requestId, "Cette demande a déjà reçu une réponse. Rechargez la page.");
    await markProRequestRefused(requestId);
    return { ok: true, intent, requestId, message: `Demande de ${request.companyName} refusée. Rien n’a été créé dans Shopify.` };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Action « Clients pro » impossible", error, { intent, requestId });
    return failed(intent, requestId, "Ça n’a pas marché. Réessayez dans un instant.");
  }
}
