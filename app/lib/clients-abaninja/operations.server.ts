import { logError, logInfo } from "../core/logger.server";
import { makePro } from "../pros/shopify.server";
import { ShopifyUserErrors, type ShopifyGraphqlError } from "../shopify/errors";
import { plainShopifyRefusal } from "../shopify/plain-refusal";
import type { Outcome } from "./batch";
import { cardLink, toMailingAddress, toPersonCustomerInput, toProAccountInput } from "./card-inputs";
import type { AbaNinjaCard } from "./cards";
import type { OperationContext } from "./context.server";
import type { CardStatus } from "./match";
import type { ShopifyClient } from "./shopify-client";
import { addAddress, createPersonCustomer, setLinks, setPhone, tagPro } from "./shopify-write.server";
import { missingEmailSentence } from "./view";

/**
 * Relier une fiche à un client, ou la créer dans la boutique. Une société devient client pro comme dans
 * « Clients pro » (entreprise, paiement à N jours, étiquette « pro »), sans e-mail d'invitation.
 * Le lien est posé sur l'entreprise dès sa création, et une entreprise qui le porte déjà est reprise :
 * un nouvel essai ne crée pas de seconde entreprise.
 */

const NOTHING_TWICE = "Réessayez dans un instant\u202F: rien ne sera créé deux fois.";
const NO_INVOICE_TERMS = " Attention\u202F: pas de paiement sur facture trouvé dans Shopify, il paiera en ligne comme un particulier.";

type AbsentStatus = Extract<CardStatus, { kind: "absent" }>;

function refused(step: string, error: ShopifyGraphqlError, card: AbaNinjaCard): Outcome {
  logError(`Clients AbaNinja : ${step}`, error, { fiche: card.uuid });
  const plain = error instanceof ShopifyUserErrors ? plainShopifyRefusal(error.message) : null;
  return { ok: false, message: plain ?? `Shopify ne répond pas pour le moment. ${NOTHING_TWICE}` };
}

/** Entreprise Shopify qui porte déjà le lien de cette fiche (création interrompue avant le rattachement du client). */
function companyCarrying(context: OperationContext, card: AbaNinjaCard): string | null {
  return context.side.linkedCompanies.find((company) => company.link.uuid === card.uuid)?.companyId ?? null;
}

/** Compléments d'une personne : adresse et téléphone d'AbaNinja s'ils manquent. Un échec n'annule pas le lien. */
async function complete(context: OperationContext, card: AbaNinjaCard, client: ShopifyClient): Promise<string> {
  const notes: string[] = [];
  const address = client.hasAddress ? null : toMailingAddress(card);
  if (address !== null) {
    const added = await addAddress(context.admin, client.customerId, address);
    if (!added.ok) logError("Clients AbaNinja : adresse non ajoutée", added.error, { fiche: card.uuid });
    notes.push(added.ok ? "Son adresse a été reprise d’AbaNinja." : "L’adresse d’AbaNinja n’a pas pu être ajoutée.");
  }
  if (client.phone === null && card.phone !== null) {
    const saved = await setPhone(context.admin, client.customerId, card.phone);
    if (!saved.ok) logError("Clients AbaNinja : téléphone non ajouté", saved.error, { fiche: card.uuid });
    notes.push(saved.ok ? "Son téléphone a été repris d’AbaNinja." : "Le téléphone d’AbaNinja n’a pas pu être ajouté.");
  }
  return notes.map((note) => ` ${note}`).join("");
}

interface ProOptions {
  readonly existingCompanyId: string | null;
  readonly newCustomerOnly?: boolean;
}

/** Client pro créé ou complété ; renvoie aussi si le paiement sur facture a pu être réglé. */
async function proCompany(context: OperationContext, card: AbaNinjaCard, email: string, phone: string | null, options: ProOptions) {
  const link = cardLink(card);
  const terms = options.existingCompanyId === null ? await context.paymentTerms() : null;
  const made = await makePro(context.admin, toProAccountInput(card, email, phone), {
    existingCompanyId: options.existingCompanyId,
    paymentTermsTemplateId: terms,
    invite: false,
    ...(options.newCustomerOnly === true ? { newCustomerOnly: true } : {}),
    onCompanyCreated: async (companyId) => {
      const linked = await setLinks(context.admin, [companyId], link);
      if (!linked.ok) logError("Clients AbaNinja : lien de l'entreprise non posé", linked.error, { fiche: card.uuid });
    },
  });
  const termsNote = options.existingCompanyId === null && terms === null ? NO_INVOICE_TERMS : "";
  return { made, termsNote };
}

/** Société déjà reliée mais compte pro inachevé (étiquette ou rôle) : on refait la fin, sans rien créer. */
export async function finishPro(context: OperationContext, card: AbaNinjaCard, client: ShopifyClient): Promise<Outcome> {
  const done = `C’est terminé\u202F: ${card.name} est client pro.`;
  const companyId = client.linkedCompanyId ?? client.companyIds[0] ?? null;
  if (companyId === null || client.email === null) {
    const tagged = await tagPro(context.admin, client.customerId);
    return tagged.ok ? { ok: true, message: done } : refused("étiquette pro", tagged.error, card);
  }
  const { made } = await proCompany(context, card, client.email, card.phone, { existingCompanyId: companyId });
  return made.ok ? { ok: true, message: done } : { ok: false, message: made.error.message };
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
  const { made, termsNote } = await proCompany(context, card, client.email, card.phone, { existingCompanyId: companyCarrying(context, card) });
  if (!made.ok) return { ok: false, message: made.error.message };
  const linked = await setLinks(context.admin, [made.value.customerId, made.value.companyId], link);
  if (!linked.ok) return refused("lien du client pro", linked.error, card);
  logInfo("Clients AbaNinja : fiche reliée à un client devenu pro", { fiche: card.uuid });
  return { ok: true, message: termsNote === "" ? `${done} Il est client pro, avec paiement sur facture.` : `${done} Il est client pro.${termsNote}` };
}

async function createCompany(context: OperationContext, card: AbaNinjaCard, email: string, phone: string | null, after: string): Promise<Outcome> {
  if (companyCarrying(context, card) !== null) {
    return { ok: false, message: `Une entreprise de la boutique porte déjà la fiche ${card.name}, sans client. Ouvrez-la dans Shopify pour y ajouter la personne.` };
  }
  const { made, termsNote } = await proCompany(context, card, email, phone, { existingCompanyId: null, newCustomerOnly: true });
  if (!made.ok) return { ok: false, message: made.error.message };
  const linked = await setLinks(context.admin, [made.value.customerId, made.value.companyId], cardLink(card));
  if (!linked.ok) logError("Clients AbaNinja : lien du client non posé (celui de l'entreprise suffit)", linked.error, { fiche: card.uuid });
  return { ok: true, message: `${card.name} est créé dans la boutique, en client pro. ${after}${termsNote}` };
}

export async function createCard(context: OperationContext, status: AbsentStatus): Promise<Outcome> {
  const { card, email, phone } = status;
  if (email === null) return { ok: false, message: missingEmailSentence(status) };
  const after = `Il pourra se connecter à la boutique avec ${email}. Aucun e-mail ne lui a été envoyé.`;
  if (card.kind === "company") return createCompany(context, card, email, phone, after);
  const created = await createPersonCustomer(context.admin, toPersonCustomerInput(card, email, phone));
  if (!created.ok) return refused("création du client", created.error, card);
  const address = toMailingAddress(card);
  const added = address === null ? null : await addAddress(context.admin, created.value, address);
  if (added !== null && !added.ok) logError("Clients AbaNinja : adresse non ajoutée", added.error, { fiche: card.uuid });
  const addressNote = added !== null && !added.ok ? " Son adresse n’a pas pu être ajoutée\u202F: ajoutez-la dans sa fiche." : "";
  return { ok: true, message: `${card.name} est créé dans la boutique. ${after}${addressNote}` };
}
