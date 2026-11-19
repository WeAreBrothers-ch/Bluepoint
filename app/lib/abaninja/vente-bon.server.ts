import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import { isProTestBuyer } from "../factures/abaninja-lines";
import { findInvoiceByOrder } from "../factures/repository.server";
import type { OrderForInvoice } from "../factures/shopify-order.server";
import type { OrderGid } from "../shopify/ids";
import { createAddress } from "./addresses.server";
import { readAbaNinjaConfig, type AbaNinjaConfig } from "./config.server";
import { createDeliveryNote, getDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { deleteCompany } from "./invoice-cleanup.server";
import { classifyCreateFailure } from "./invoice-errors";
import { NOTE_TOO_LATE, planTestSaleNote, tooLateForNote, type SaleNotePlan } from "./vente-bon-plan";
import { proTestClient } from "./vente-client-pro.server";
import { loadSaleOrder, saleInputOf } from "./vente-bon-source.server";
import { NOTE_ERASE_HINT, SHARED_CLIENT_HINT, unsavedChange } from "./vente-errors";
import { claimSale, findSale, markNote, releaseRefusedSale, type LeftClient, type NoteUpdate } from "./vente-repository.server";

/**
 * Bon de livraison AbaNinja d'une commande d'essai, fait dès qu'elle arrive (webhook) ou depuis sa fiche.
 * La ligne de vente est prise AVANT tout appel à AbaNinja : un renvoi du webhook ne refait jamais un bon.
 * Un bon dont le résultat est incertain n'est jamais redemandé : il est marqué « à vérifier ».
 */

export type SaleNoteOutcome =
  | { readonly kind: "pas_concernee" }
  | { readonly kind: "deja_fait" }
  | { readonly kind: "cree"; readonly noteNumber: string | null }
  | { readonly kind: "refuse" | "incertain"; readonly message: string };

type Receiver = Required<LeftClient>;

/** Le client du bon, ou la réponse quand il n'a pas pu être obtenu (la ligne est alors déjà marquée refusée). */
type ClientStep = { readonly ok: true; readonly client: Receiver } | { readonly ok: false; readonly outcome: SaleNoteOutcome };

const CHECK_HINT = "Regardez dans AbaNinja, menu « Bulletins de livraison », avant de recommencer.";

function refused(message: string): SaleNoteOutcome {
  return { kind: "refuse", message };
}

async function remember(orderId: OrderGid, update: NoteUpdate): Promise<void> {
  const problem = unsavedChange(await markNote(orderId, update));
  if (problem !== null) logError("Bon de livraison AbaNinja : état non enregistré", problem, { orderId, state: update.state });
}

/**
 * Pas de bon dans AbaNinja : la ligne est marquée refusée, et un nouvel essai pourra la reprendre. Un client
 * resté est noté ici : le nouvel essai le supprime d'abord, l'effacement des essais le retrouve.
 */
async function refuse(orderId: OrderGid, errorCode: string, message: string, client: LeftClient = {}): Promise<SaleNoteOutcome> {
  await remember(orderId, { state: "refuse", errorCode, ...client });
  return refused(message);
}

/** Le bon existe peut-être : la ligne garde le client d'essai, pour que l'effacement le retrouve. */
async function uncertain(orderId: OrderGid, errorCode: string, reference: string, client: Receiver): Promise<SaleNoteOutcome> {
  await remember(orderId, { state: "incertain", errorCode, ...client });
  return { kind: "incertain", message: `AbaNinja n’a pas confirmé le bon de livraison (référence ${reference}). ${CHECK_HINT}` };
}

async function noteRefused(config: AbaNinjaConfig, orderId: OrderGid, client: Receiver, plan: SaleNotePlan, error: AbaNinjaError): Promise<SaleNoteOutcome> {
  const message = `AbaNinja a refusé le bon de livraison : ${error.message}`;
  // Le client pro fictif sert aux autres essais : il ne part qu'avec l'effacement des essais.
  if (plan.sharedClient) return refuse(orderId, error.code, `${message} ${SHARED_CLIENT_HINT}`);
  const removed = await deleteCompany(config, client.companyUuid);
  if (removed.ok) return refuse(orderId, error.code, message);
  return refuse(orderId, error.code, `${message} Le client d’essai « ${plan.clientName} » reste dans AbaNinja. ${NOTE_ERASE_HINT}`, client);
}

/** Un client d'essai fait pour ce seul bon (commande fictive d'un particulier). */
async function ownClient(config: AbaNinjaConfig, orderId: OrderGid, plan: SaleNotePlan): Promise<ClientStep> {
  const receiver = await createAddress(config, plan.clientAddress, { force: true });
  if (!receiver.ok) {
    const hint = `Si un client « ${plan.clientName} » apparaît quand même dans AbaNinja, supprimez-le.`;
    return { ok: false, outcome: await refuse(orderId, receiver.error.code, `AbaNinja n’a pas créé le client d’essai : ${receiver.error.message} ${hint}`) };
  }
  if (!("companyUuid" in receiver.value)) {
    // L'app ne sait pas supprimer une personne dans AbaNinja : elle la nomme, sinon chaque essai en ajouterait une.
    const person = `AbaNinja a créé une personne « ${plan.clientName} » au lieu d’une entreprise : le bon n’est pas fait.`;
    return { ok: false, outcome: await refuse(orderId, "client_personne", `${person} Supprimez-la dans AbaNinja avant de réessayer.`) };
  }
  return { ok: true, client: { addressUuid: receiver.value.addressUuid, companyUuid: receiver.value.companyUuid } };
}

/** Le client du bon : le client pro fictif (créé une fois, puis repris), ou un client fait pour ce seul bon. */
async function noteClient(config: AbaNinjaConfig, shop: string, orderId: OrderGid, plan: SaleNotePlan, now: Date): Promise<ClientStep> {
  if (!plan.sharedClient) return ownClient(config, orderId, plan);
  const shared = await proTestClient(config, shop, plan.clientAddress, now);
  return shared.ok ? { ok: true, client: shared.value } : { ok: false, outcome: await refuse(orderId, shared.error.code, shared.error.message) };
}

/** Le client d'essai puis le bon, en brouillon. Rien n'est envoyé à personne. */
async function makeNote(config: AbaNinjaConfig, shop: string, orderId: OrderGid, plan: SaleNotePlan, now: Date): Promise<SaleNoteOutcome> {
  const step = await noteClient(config, shop, orderId, plan, now);
  if (!step.ok) return step.outcome;
  const { client } = step;
  const created = await createDeliveryNote(config, { ...plan.note, receiver: client });
  if (!created.ok) {
    if (classifyCreateFailure(created.error) === "refusee") return noteRefused(config, orderId, client, plan, created.error);
    return uncertain(orderId, created.error.code, plan.reference, client);
  }
  if (created.value.kind === "incertain") return uncertain(orderId, "bon_en_attente", plan.reference, client);
  const noteUuid = created.value.uuid;
  logInfo("Bon de livraison AbaNinja créé", { orderId, noteUuid });
  const read = await getDeliveryNote(config, noteUuid);
  const noteNumber = read.ok ? read.value.number : null;
  await remember(orderId, { state: "cree", noteUuid, noteNumber, ...client });
  return { kind: "cree", noteNumber };
}

/** Le client d'essai laissé par un bon refusé est supprimé avant un nouvel essai ; null s'il n'est plus dans AbaNinja. */
async function leftClientRemoved(orderId: OrderGid, companyUuid: string): Promise<SaleNoteOutcome | null> {
  const config = readAbaNinjaConfig();
  if (!config.ok) return refused(config.error.message);
  const removed = await deleteCompany(config.value, companyUuid);
  if (removed.ok || removed.error.code === "introuvable") {
    logInfo("Client d’essai resté supprimé avant un nouveau bon", { orderId, companyUuid });
    return null;
  }
  const left = "Le bon précédent a été refusé et son client d’essai est resté dans AbaNinja : l’app n’a pas pu le supprimer.";
  return refused(`${left} ${removed.error.message} ${NOTE_ERASE_HINT}`);
}

/**
 * La réponse quand la commande a déjà eu son essai (bon fait ou à vérifier) ; null pour faire le bon. Une ligne
 * refusée est libérée pour recommencer, une fois supprimé le client d'essai qu'elle avait laissé dans AbaNinja.
 */
async function earlierAttempt(orderId: OrderGid): Promise<SaleNoteOutcome | null> {
  const existing = await findSale(orderId);
  if (!existing.ok) throw existing.error;
  const row = existing.value;
  if (row === null) return null;
  if (row.noteState !== "refuse") return { kind: "deja_fait" };
  const blocked = row.companyUuid === null ? null : await leftClientRemoved(orderId, row.companyUuid);
  if (blocked !== null) return blocked;
  const released = await releaseRefusedSale(orderId);
  if (!released.ok) throw released.error;
  return null;
}

/** Facturée ou livrée avant les bons de livraison : un bon ferait une pièce de trop à côté de la facture. */
async function tooLate(orderId: OrderGid, source: OrderForInvoice): Promise<boolean> {
  const invoice = await findInvoiceByOrder(orderId);
  return tooLateForNote({ hasInvoice: invoice !== null, fulfillments: source.contact.fulfillments });
}

export async function createSaleNoteForOrder(
  admin: AdminApiContext,
  shop: string,
  orderId: OrderGid,
  now: Date = new Date(),
): Promise<SaleNoteOutcome> {
  const earlier = await earlierAttempt(orderId);
  if (earlier !== null) return earlier;
  const order = await loadSaleOrder(admin, orderId);
  if (!order.ok) return refused(order.error.message);
  if (!order.value.isTest) return { kind: "pas_concernee" };
  if (await tooLate(orderId, order.value.source)) return refused(NOTE_TOO_LATE);
  const config = readAbaNinjaConfig();
  if (!config.ok) return refused(config.error.message);
  const input = await saleInputOf(shop, order.value, now);
  if (!input.ok) return refused(input.error.message);
  const plan = planTestSaleNote(input.value, order.value.plannedDate, now, isProTestBuyer(order.value.source));
  if (!plan.ok) return refused(`${plan.error.message} Le bon de livraison n’est pas fait.`);
  const orderName = order.value.source.order.name;
  const claim = await claimSale({ shop, orderId, orderName, reference: plan.value.reference, isTest: true });
  if (!claim.ok) throw claim.error;
  if (!claim.value.claimed) return { kind: "deja_fait" };
  logInfo("Bon de livraison AbaNinja : création", { orderId, reference: plan.value.reference });
  return makeNote(config.value, shop, orderId, plan.value, now);
}
