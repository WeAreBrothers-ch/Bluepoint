import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { listDecidedProRequests, listPendingProRequests } from "./repository.server";
import { canCreatePros } from "./shopify.server";
import { toProRequestView, type ProRequestView } from "./view";

/** Données de la page « Clients pro ». */

export interface ProsPageData {
  readonly pending: readonly ProRequestView[];
  readonly decided: readonly ProRequestView[];
  /** false : l'app n'a pas encore le droit de créer des clients (étape d'autorisation à faire). */
  readonly canCreate: boolean;
}


export async function loadProsPage(admin: AdminApiContext, shop: string): Promise<ProsPageData> {
  const [pending, decided, access] = await Promise.all([listPendingProRequests(shop), listDecidedProRequests(shop), canCreatePros(admin)]);
  return {
    pending: pending.map(toProRequestView),
    decided: decided.map(toProRequestView),
    // Autorisations illisibles : on laisse essayer, le message d'erreur dira quoi faire.
    canCreate: access !== false,
  };
}
