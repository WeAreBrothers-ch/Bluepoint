import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { swissIsoDate } from "../agenda/dates";
import { logError } from "../core/logger.server";
import type { IsoDate } from "../metafields/definitions";
import { paymentTermDaysFor } from "./action.server";
import { loadCatalog, searchCustomers } from "./reads.server";
import type { CustomerOption, ProductOption } from "./types";

/** Données de la page « Prendre une commande » : vins en vente, délai de paiement, jour suisse. */

export interface CommandePageData {
  readonly products: readonly ProductOption[];
  readonly truncated: boolean;
  readonly loadError: string | null;
  readonly paymentTermDays: number;
  readonly today: IsoDate;
  /** Client déjà choisi (depuis sa fiche : `?client=…`), ou null. */
  readonly initialCustomer: CustomerOption | null;
}

/** Le client de `?client=` : seulement un numéro, retrouvé par son identifiant. */
async function loadInitialCustomer(admin: AdminApiContext, clientParam: string | null): Promise<CustomerOption | null> {
  if (clientParam === null || !/^\d{1,20}$/.test(clientParam)) return null;
  const found = await searchCustomers(admin, `id:${clientParam}`);
  if (!found.ok) {
    logError("Client de la commande illisible", found.error, { clientParam });
    return null;
  }
  return found.value[0] ?? null;
}

export async function loadCommandePage(admin: AdminApiContext, shop: string, now: Date, clientParam: string | null = null): Promise<CommandePageData> {
  const [catalog, paymentTermDays, initialCustomer] = await Promise.all([
    loadCatalog(admin),
    paymentTermDaysFor(shop),
    loadInitialCustomer(admin, clientParam),
  ]);
  if (!catalog.ok) logError("Catalogue de la commande par téléphone illisible", catalog.error, { shop });
  return {
    products: catalog.ok ? catalog.value.products : [],
    truncated: catalog.ok && catalog.value.truncated,
    loadError: catalog.ok ? null : "La liste des vins n’a pas pu être chargée depuis Shopify. Rechargez la page.",
    paymentTermDays,
    today: swissIsoDate(now),
    initialCustomer,
  };
}
