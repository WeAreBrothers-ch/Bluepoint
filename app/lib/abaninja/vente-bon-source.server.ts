import type { InvoiceInput } from "@bluepoint/facture-qr";
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { failure, success, type Result } from "../core/result";
import { abaNinjaLinesOf, goesToAbaNinja } from "../factures/abaninja-lines";
import { fetchOrderForInvoice, type OrderForInvoice } from "../factures/shopify-order.server";
import { loadCompleteSettings } from "../reglages/settings.server";
import type { OrderGid } from "../shopify/ids";
import { todayInZurich } from "./invoice-status";

/**
 * Ce qu'il faut pour faire ou refaire le bon d'une commande : la commande lue dans Shopify, son jour de
 * livraison prévu, et ses lignes (mêmes prix, même TVA, même total que la facture). Chaque refus est écrit pour Eliott.
 */

export interface SaleOrder {
  readonly source: OrderForInvoice;
  /** Jour choisi au panier ou dans l'agenda (AAAA-MM-JJ), s'il y en a un. */
  readonly plannedDate: string | null;
  /** Commande d'essai (étiquette « fictif » sur la commande ou le client). */
  readonly isTest: boolean;
}

export interface SaleSource extends SaleOrder {
  readonly input: InvoiceInput;
}

export async function loadSaleOrder(admin: AdminApiContext, orderId: OrderGid): Promise<Result<SaleOrder, Error>> {
  const read = await fetchOrderForInvoice(admin, orderId);
  if (!read.ok) return failure(new Error(`${read.error.message} Le bon de livraison n’est pas fait.`));
  const plannedDate = read.value.contact.dateSouhaitee?.value ?? null;
  return success({ source: read.value, plannedDate, isTest: goesToAbaNinja(read.value) });
}

/** Les lignes du bon, d'après les réglages de la boutique (vendeur, délai de paiement). */
export async function saleInputOf(shop: string, order: SaleOrder, now: Date): Promise<Result<InvoiceInput, Error>> {
  const settings = await loadCompleteSettings(shop);
  if (settings === null) return failure(new Error("Les réglages de la boutique sont incomplets : le bon de livraison n’est pas fait."));
  const today = todayInZurich(now);
  const lines = abaNinjaLinesOf(order.source.order, settings, { issueDate: today, deliveryDate: today });
  return lines.ok ? lines : failure(new Error([lines.error.message, ...lines.error.details].join(" ")));
}

export async function loadSaleSource(admin: AdminApiContext, shop: string, orderId: OrderGid, now: Date): Promise<Result<SaleSource, Error>> {
  const order = await loadSaleOrder(admin, orderId);
  if (!order.ok) return order;
  const input = await saleInputOf(shop, order.value, now);
  return input.ok ? success({ ...order.value, input: input.value }) : input;
}
