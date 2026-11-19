import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError, logInfo } from "../core/logger.server";
import type { OrderGid } from "../shopify/ids";
import { readAbaNinjaConfig } from "./config.server";
import { cancelDeliveryNote, updateDeliveryNote } from "./delivery-notes.server";
import { todayInZurich } from "./invoice-status";
import { plannedDeliveryDate, saleNoteBody } from "./vente-bon-plan";
import { loadSaleSource } from "./vente-bon-source.server";
import { unsavedChange } from "./vente-errors";
import { findSale, markNote, type AbaNinjaSale } from "./vente-repository.server";

/**
 * Le bon de livraison suit la commande : « Modifier les vins » le remet aux vins actuels, l'annulation
 * l'annule pour de bon. Seul un bon fait (« cree ») dont la facture n'est pas commencée est touché : un bon
 * en train de devenir une facture, ou réglé par elle, ne bouge plus.
 */

export type FollowOutcome = { readonly kind: "rien" } | { readonly kind: "fait" } | { readonly kind: "echec"; readonly message: string };

const NOTHING: FollowOutcome = { kind: "rien" };

type MadeNote = AbaNinjaSale & { readonly noteUuid: string; readonly addressUuid: string; readonly companyUuid: string };

function failed(message: string): FollowOutcome {
  return { kind: "echec", message };
}

/** Pourquoi un bon qui devient une facture ne suit plus, et quoi faire (affiché après « … n’a pas suivi : »). */
const CONVERTING = {
  modifier: "il est déjà en train de devenir une facture et ne se modifie plus.",
  annuler: "il est déjà en train de devenir une facture et ne s’annule plus. Annulez la facture dans AbaNinja.",
} as const;

/** La ligne de la commande quand son bon est fait dans AbaNinja, sans facture commencée (et relève de cette boutique). */
async function madeNoteOf(shop: string, orderId: string, intent: keyof typeof CONVERTING): Promise<MadeNote | FollowOutcome> {
  const sale = await findSale(orderId);
  if (!sale.ok) return failed("l’app n’a pas pu relire le bon.");
  const row = sale.value;
  if (row === null || row.shop !== shop || row.noteState !== "cree") return NOTHING;
  if (row.invoiceState !== null) return failed(CONVERTING[intent]);
  const { noteUuid, addressUuid, companyUuid } = row;
  if (noteUuid === null || addressUuid === null || companyUuid === null) return failed("le bon n’est pas complet dans l’app.");
  return { ...row, noteUuid, addressUuid, companyUuid };
}

function isOutcome(value: MadeNote | FollowOutcome): value is FollowOutcome {
  return "kind" in value;
}

export async function syncSaleNote(admin: AdminApiContext, shop: string, orderId: OrderGid, now: Date = new Date()): Promise<FollowOutcome> {
  const sale = await madeNoteOf(shop, orderId, "modifier");
  if (isOutcome(sale)) return sale;
  const config = readAbaNinjaConfig();
  if (!config.ok) return failed(config.error.message);
  const source = await loadSaleSource(admin, shop, orderId, now);
  if (!source.ok) return failed(source.error.message);
  const noteDate = todayInZurich(sale.createdAt);
  const deliveryDate = plannedDeliveryDate(source.value.plannedDate, todayInZurich(now));
  const body = saleNoteBody(source.value.input, { reference: sale.reference, orderName: sale.orderName, noteDate, deliveryDate });
  if (!body.ok) return failed(body.error.message);
  const updated = await updateDeliveryNote(config.value, sale.noteUuid, { ...body.value, receiver: { addressUuid: sale.addressUuid, companyUuid: sale.companyUuid } });
  if (!updated.ok) return failed(updated.error.message);
  logInfo("Bon de livraison AbaNinja remis à jour", { orderId, reference: sale.reference });
  return { kind: "fait" };
}

/** AbaNinja n'a pas annulé : si l'autre action partie en même temps (bouton ou webhook) l'a fait, c'est fait. */
async function cancelledMeanwhile(orderId: string, message: string): Promise<FollowOutcome> {
  const again = await findSale(orderId);
  return again.ok && again.value?.noteState === "annule" ? { kind: "fait" } : failed(message);
}

/**
 * Bon annulé dans AbaNinja : la ligne le note. Si elle ne le peut plus parce que la facture est née du bon
 * entre-temps (« J'ai livré » au même moment), cette facture est à annuler à la main.
 */
async function cancelNoted(orderId: string): Promise<FollowOutcome> {
  const problem = unsavedChange(await markNote(orderId, { state: "annule" }));
  if (problem === null) return { kind: "fait" };
  logError("Bon AbaNinja annulé, état non enregistré", problem, { orderId });
  const again = await findSale(orderId);
  const becameInvoice = again.ok && again.value !== null && again.value.invoiceState !== null;
  return becameInvoice ? failed("il est devenu une facture pendant l’annulation. Annulez la facture dans AbaNinja.") : { kind: "fait" };
}

/** Rejouable : le bouton « Annuler » puis le webhook orders/cancelled n'annulent qu'une fois. */
export async function cancelSaleNote(shop: string, orderId: string): Promise<FollowOutcome> {
  const sale = await madeNoteOf(shop, orderId, "annuler");
  if (isOutcome(sale)) return sale;
  const config = readAbaNinjaConfig();
  if (!config.ok) return failed(config.error.message);
  const cancelled = await cancelDeliveryNote(config.value, sale.noteUuid);
  if (!cancelled.ok) return cancelledMeanwhile(orderId, cancelled.error.message);
  logInfo("Bon de livraison AbaNinja annulé", { orderId, reference: sale.reference });
  return cancelNoted(orderId);
}
