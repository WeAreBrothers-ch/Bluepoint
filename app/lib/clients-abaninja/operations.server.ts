import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { findPaymentTemplate } from "../commande/reads.server";
import { logError, logInfo } from "../core/logger.server";
import { makePro } from "../pros/shopify.server";
import { loadStoredSettings } from "../reglages/settings.server";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import type { Outcome } from "./batch";
import { cardLink, toMailingAddress, toPersonCustomerInput, toProAccountInput } from "./card-inputs";
import type { AbaNinjaCard } from "./cards";
import type { CardStatus } from "./match";
import type { ShopifyClient } from "./shopify-client";
import { addAddress, createPersonCustomer, setLinks, setPhone, tagPro } from "./shopify-write.server";

/**
 * Relier une fiche à un client, ou la créer dans la boutique. Une société devient client pro comme dans
 * « Clients pro » (entreprise, paiement à N jours, étiquette « pro »), sans e-mail d'invitation.
 * Le lien est posé sur l'entreprise dès sa création : un nouvel essai ne crée jamais une seconde entreprise.
 */

const DEFAULT_TERM_DAYS = 30;
const NOTHING_TWICE = "Réessayez dans un instant\u202F: rien ne sera créé deux fois.";

export interface OperationContext {
  readonly admin: AdminApiContext;
  readonly shop: string;
}

type AbsentStatus = Extract<CardStatus, { kind: "absent" }>;

async function paymentTemplateId(context: OperationContext): Promise<string | null> {
  const settings = await loadStoredSettings(context.shop);
  const template = await findPaymentTemplate(context.admin, "facture", settings?.paymentTermDays ?? DEFAULT_TERM_DAYS);
  return template?.template.id ?? null;
}

function refused(step: string, error: ShopifyGraphqlError, card: AbaNinjaCard): Outcome {
  logError(`Clients AbaNinja : ${step}`, error, { fiche: card.uuid });
  const plain = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  return { ok: false, message: plain ?? `Shopify ne répond pas pour le moment. ${NOTHING_TWICE}` };
}

/** Compléments d'une personne : adresse et téléphone d'AbaNinja s'ils manquent. Un échec n'annule pas le lien. */
async function complete(context: OperationContext, card: AbaNinjaCard, client: ShopifyClient): Promise<string> {
  const added: string[] = [];
  const address = client.hasAddress ? null : toMailingAddress(card);
  if (address !== null && (await addAddress(context.admin, client.customerId, address)).ok) added.push("son adresse");
  if (client.phone === null && card.phone !== null && (await setPhone(context.admin, client.customerId, card.phone)).ok) added.push("son téléphone");
  return added.length === 0 ? "" : ` ${added.join(" et ")} ${added.length > 1 ? "ont" : "a"} été repris d’AbaNinja.`;
}

async function proCompany(context: OperationContext, card: AbaNinjaCard, email: string, phone: string | null) {
  const link = cardLink(card);
  return makePro(context.admin, toProAccountInput(card, email, phone), {
    existingCompanyId: null,
    paymentTermsTemplateId: await paymentTemplateId(context),
    invite: false,
    onCompanyCreated: async (companyId) => {
      const linked = await setLinks(context.admin, [companyId], link);
      if (!linked.ok) logError("Clients AbaNinja : lien de l'entreprise non posé", linked.error, { fiche: card.uuid });
    },
  });
}

export async function linkCard(context: OperationContext, card: AbaNinjaCard, client: ShopifyClient): Promise<Outcome> {
  const link = cardLink(card);
  const done = `C’est fait\u202F: ${card.name} est relié à ${client.displayName}.`;
  if (card.kind === "person") {
    const linked = await setLinks(context.admin, [client.customerId], link);
    if (!linked.ok) return refused("lien du client", linked.error, card);
    return { ok: true, message: `${done}${await complete(context, card, client)}` };
  }
  const existingCompany = client.companyIds[0];
  if (existingCompany !== undefined || client.email === null) {
    const owners = existingCompany === undefined ? [client.customerId] : [client.customerId, existingCompany];
    const linked = await setLinks(context.admin, owners, link);
    if (!linked.ok) return refused("lien du client pro", linked.error, card);
    const tagged = await tagPro(context.admin, client.customerId);
    if (!tagged.ok) return refused("étiquette pro", tagged.error, card);
    const noCompany = existingCompany === undefined ? " Pas d’entreprise créée dans Shopify\u202F: ce client n’a pas d’e-mail." : "";
    return { ok: true, message: `${done} Il est client pro.${noCompany}` };
  }
  const made = await proCompany(context, card, client.email, card.phone);
  if (!made.ok) return { ok: false, message: made.error.message };
  const linked = await setLinks(context.admin, [made.value.customerId, made.value.companyId], link);
  if (!linked.ok) return refused("lien du client pro", linked.error, card);
  logInfo("Clients AbaNinja : fiche reliée à un client devenu pro", { fiche: card.uuid });
  return { ok: true, message: `${done} Il est client pro, avec paiement sur facture.` };
}

export async function createCard(context: OperationContext, status: AbsentStatus): Promise<Outcome> {
  const { card, email, phone } = status;
  if (email === null) return { ok: false, message: missingEmailMessage(status) };
  const after = `Il pourra se connecter à la boutique avec ${email}. Aucun e-mail ne lui a été envoyé.`;
  if (card.kind === "company") {
    const made = await proCompany(context, card, email, phone);
    if (!made.ok) return { ok: false, message: made.error.message };
    const linked = await setLinks(context.admin, [made.value.customerId, made.value.companyId], cardLink(card));
    if (!linked.ok) logError("Clients AbaNinja : lien du client non posé (celui de l'entreprise suffit)", linked.error, { fiche: card.uuid });
    return { ok: true, message: `${card.name} est créé dans la boutique, en client pro. ${after}` };
  }
  const created = await createPersonCustomer(context.admin, toPersonCustomerInput(card, email, phone));
  if (!created.ok) return refused("création du client", created.error, card);
  const address = toMailingAddress(card);
  if (address !== null) {
    const added = await addAddress(context.admin, created.value, address);
    if (!added.ok) logError("Clients AbaNinja : adresse non ajoutée", added.error, { fiche: card.uuid });
  }
  return { ok: true, message: `${card.name} est créé dans la boutique. ${after}` };
}

export function missingEmailMessage(status: AbsentStatus): string {
  return status.blockedBy === null
    ? `${status.card.name} n’a pas d’e-mail dans AbaNinja\u202F: ajoutez-le dans AbaNinja, puis rechargez la page.`
    : `L’e-mail de ${status.card.name} appartient déjà à ${status.blockedBy} dans la boutique. Corrigez l’e-mail dans AbaNinja, ou reliez la fiche à ce client.`;
}
