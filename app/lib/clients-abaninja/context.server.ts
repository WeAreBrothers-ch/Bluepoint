import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { findPaymentTemplate } from "../commande/reads.server";
import { logError } from "../core/logger.server";
import { loadStoredSettings } from "../reglages/settings.server";
import type { ShopifySide } from "./shopify-client";

/**
 * Ce que chaque bouton partage pendant un toucher : la boutique telle qu'elle vient d'être relue, et les conditions
 * de paiement des pros, lues une seule fois (un lot de 15 sociétés ne relit pas 15 fois la base et Shopify).
 */

const DEFAULT_TERM_DAYS = 30;

export interface OperationContext {
  readonly admin: AdminApiContext;
  readonly shop: string;
  readonly side: ShopifySide;
  /** Modèle « paiement sur facture à N jours » des réglages, ou null s'il n'existe pas dans Shopify. */
  readonly paymentTerms: () => Promise<string | null>;
}

async function readTermDays(shop: string): Promise<number> {
  try {
    return (await loadStoredSettings(shop))?.paymentTermDays ?? DEFAULT_TERM_DAYS;
  } catch (error) {
    logError("Clients AbaNinja : réglages illisibles, paiement à 30 jours", error);
    return DEFAULT_TERM_DAYS;
  }
}

async function readPaymentTerms(admin: AdminApiContext, shop: string): Promise<string | null> {
  const template = await findPaymentTemplate(admin, "facture", await readTermDays(shop));
  return template?.template.id ?? null;
}

export function operationContext(admin: AdminApiContext, shop: string, side: ShopifySide): OperationContext {
  let terms: Promise<string | null> | null = null;
  return { admin, shop, side, paymentTerms: () => (terms ??= readPaymentTerms(admin, shop)) };
}
