import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * L'ancienne page « Aide » n'existe plus : l'app est assez simple pour s'en passer.
 * Un ancien lien (favori, historique) ramène aux livraisons au lieu d'afficher « page introuvable ».
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { redirect } = await authenticate.admin(request);
  return redirect("/app");
};
