import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { logError } from "../core/logger.server";
import type { IsoDate } from "../metafields/definitions";
import { paymentTermDaysFor } from "./action.server";
import { loadCatalog } from "./reads.server";
import type { ProductOption } from "./types";

/** Données de la page « Prendre une commande » : vins en vente, délai de paiement, jour suisse. */

export interface CommandePageData {
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly loadError: string | null;
  readonly paymentTermDays: number;
  readonly today: IsoDate;
}

export async function loadCommandePage(admin: AdminApiContext, shop: string, now: Date): Promise<CommandePageData> {
  const [catalog, paymentTermDays] = await Promise.all([loadCatalog(admin), paymentTermDaysFor(shop)]);
  if (!catalog.ok) logError("Catalogue de la commande par téléphone illisible", catalog.error, { shop });
  return {
    products: catalog.ok ? catalog.value.products : [],
    truncated: catalog.ok && catalog.value.truncated,
    loadError: catalog.ok ? null : "La liste des vins n’a pas pu être chargée depuis Shopify. Rechargez la page.",
    paymentTermDays,
    today: swissIsoDate(now),
  };
}
