import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { canCreatePros } from "../pros/shopify.server";
import { loadComparison } from "./comparison.server";
import { toComparisonView, type ComparisonView } from "./view";

/** Données de la page « Clients AbaNinja » : la comparaison prête à afficher, ou ce qu'il faut faire si elle échoue. */

export type AbaNinjaClientsPageData =
  | {
      readonly state: "pret";
      readonly view: ComparisonView;
      /** false : l'app n'a pas encore le droit de créer des entreprises (sociétés → clients pro). */
      readonly canCreate: boolean;
    }
  | { readonly state: "erreur"; readonly message: string };

export async function loadAbaNinjaClientsPage(admin: AdminApiContext): Promise<AbaNinjaClientsPageData> {
  try {
    const [comparison, access] = await Promise.all([loadComparison(admin), canCreatePros(admin)]);
    if (!comparison.ok) return { state: "erreur", message: comparison.error.message };
    const { statuses, side, listing } = comparison.value;
    // Autorisations illisibles : on laisse essayer, le message d'erreur dira quoi faire.
    return { state: "pret", view: toComparisonView(statuses, side, listing), canCreate: access !== false };
  } catch (error) {
    if (error instanceof Response) throw error;
    logError("Clients AbaNinja : page impossible à préparer", error);
    return { state: "erreur", message: "Rechargez la page dans un instant. Si le problème continue, appelez la personne qui s’occupe de l’application." };
  }
}
