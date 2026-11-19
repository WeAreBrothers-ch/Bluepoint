import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import type { OrderGid } from "../shopify/ids";
import { createAddress } from "./addresses.server";
import { readAbaNinjaConfig, type AbaNinjaConfig } from "./config.server";
import { createDeliveryNote, getDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaError } from "./errors";
import { deleteCompany } from "./invoice-cleanup.server";
import { classifyCreateFailure } from "./invoice-errors";
import { planTestSaleNote, type SaleNotePlan } from "./vente-bon-plan";
import { loadSaleOrder, saleInputOf } from "./vente-bon-source.server";
import { claimSale, findSale, markNote, releaseRefusedSale, type NoteUpdate } from "./vente-repository.server";

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

const CHECK_HINT = "Regardez dans AbaNinja, menu « Bulletins de livraison », avant de recommencer.";

function refused(message: string): SaleNoteOutcome {
  return { kind: "refuse", message };
}

async function remember(orderId: OrderGid, update: NoteUpdate): Promise<void> {
  const saved = await markNote(orderId, update);
  if (!saved.ok) logError("Bon de livraison AbaNinja : état non enregistré", saved.error, { orderId, state: update.state });
}

/** Rien de sûr n'est fait dans AbaNinja : la ligne est marquée refusée, un nouvel essai pourra la reprendre. */
async function refuse(orderId: OrderGid, errorCode: string, message: string): Promise<SaleNoteOutcome> {
  await remember(orderId, { state: "refuse", errorCode });
  return refused(message);
}

async function uncertain(orderId: OrderGid, errorCode: string, reference: string): Promise<SaleNoteOutcome> {
  await remember(orderId, { state: "incertain", errorCode });
  return { kind: "incertain", message: `AbaNinja n’a pas confirmé le bon de livraison (référence ${reference}). ${CHECK_HINT}` };
}

async function noteRefused(config: AbaNinjaConfig, orderId: OrderGid, companyUuid: string, plan: SaleNotePlan, error: AbaNinjaError) {
  const removed = await deleteCompany(config, companyUuid);
  const leftover = removed.ok ? "" : ` Le client d’essai « ${plan.clientName} » reste peut-être dans AbaNinja : supprimez-le à la main.`;
  return refuse(orderId, error.code, `AbaNinja a refusé le bon de livraison : ${error.message}${leftover}`);
}

/** Le client d'essai puis le bon, en brouillon. Rien n'est envoyé à personne. */
async function makeNote(config: AbaNinjaConfig, orderId: OrderGid, plan: SaleNotePlan): Promise<SaleNoteOutcome> {
  const receiver = await createAddress(config, plan.clientAddress, { force: true });
  if (!receiver.ok) {
    const hint = `Si un client « ${plan.clientName} » apparaît quand même dans AbaNinja, supprimez-le.`;
    return refuse(orderId, receiver.error.code, `AbaNinja n’a pas créé le client d’essai : ${receiver.error.message} ${hint}`);
  }
  if (!("companyUuid" in receiver.value)) return refuse(orderId, "client_personne", "AbaNinja a créé une personne au lieu d’une entreprise : le bon n’est pas fait.");
  const { addressUuid, companyUuid } = receiver.value;
  const created = await createDeliveryNote(config, { ...plan.note, receiver: { addressUuid, companyUuid } });
  if (!created.ok) {
    if (classifyCreateFailure(created.error) === "refusee") return noteRefused(config, orderId, companyUuid, plan, created.error);
    return uncertain(orderId, created.error.code, plan.reference);
  }
  if (created.value.kind === "incertain") return uncertain(orderId, "bon_en_attente", plan.reference);
  const read = await getDeliveryNote(config, created.value.uuid);
  const noteNumber = read.ok ? read.value.number : null;
  await remember(orderId, { state: "cree", noteUuid: created.value.uuid, noteNumber, addressUuid, companyUuid });
  return { kind: "cree", noteNumber };
}

/** Vrai quand un bon existe déjà (ou est à vérifier) ; une ligne refusée est libérée pour recommencer. */
async function alreadyHandled(orderId: OrderGid): Promise<boolean> {
  const existing = await findSale(orderId);
  if (!existing.ok) throw existing.error;
  if (existing.value === null) return false;
  if (existing.value.noteState !== "refuse") return true;
  const released = await releaseRefusedSale(orderId);
  if (!released.ok) throw released.error;
  return false;
}

export async function createSaleNoteForOrder(
  admin: AdminApiContext,
  shop: string,
  orderId: OrderGid,
  now: Date = new Date(),
): Promise<SaleNoteOutcome> {
  if (await alreadyHandled(orderId)) return { kind: "deja_fait" };
  const order = await loadSaleOrder(admin, orderId);
  if (!order.ok) return refused(order.error.message);
  if (!order.value.isTest) return { kind: "pas_concernee" };
  const config = readAbaNinjaConfig();
  if (!config.ok) return refused(config.error.message);
  const input = await saleInputOf(shop, order.value, now);
  if (!input.ok) return refused(input.error.message);
  const plan = planTestSaleNote(input.value, order.value.plannedDate, now);
  if (!plan.ok) return refused(`${plan.error.message} Le bon de livraison n’est pas fait.`);
  const orderName = order.value.source.order.name;
  const claim = await claimSale({ shop, orderId, orderName, reference: plan.value.reference, isTest: true });
  if (!claim.ok) throw claim.error;
  if (!claim.value.claimed) return { kind: "deja_fait" };
  logInfo("Bon de livraison AbaNinja : création", { orderId, reference: plan.value.reference });
  return makeNote(config.value, orderId, plan.value);
}
