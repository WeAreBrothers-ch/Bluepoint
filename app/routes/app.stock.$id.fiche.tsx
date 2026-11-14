import type { LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { authenticate } from "../shopify.server";
import type { FicheLoadResult } from "../lib/stock/fiche";
import { loadFiche } from "../lib/stock/fiche.server";

/**
 * La fiche d'un vin, pour « Modifier la fiche » dans la page Stock (appelé par un fetcher, sans page).
 * /app/stock/<numéro du vin dans Shopify>/fiche
 */

export const loader = async ({ request, params }: LoaderFunctionArgs): Promise<FicheLoadResult> => {
  const { admin } = await authenticate.admin(request);
  const id = params["id"] ?? "";
  if (!/^\d{1,20}$/.test(id)) return { ok: false, message: "Ce vin est introuvable. Rechargez la page." };
  return loadFiche(admin, `gid://shopify/Product/${id}`);
};

/**
 * La fiche est lue à l'ouverture seulement. Sans cela, React Router la relirait après chaque enregistrement
 * de la page Stock, et ce qu'on est en train de taper (après une case refusée, par exemple) serait effacé.
 */
export const shouldRevalidate: ShouldRevalidateFunction = () => false;
