import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Proxy d'app : https://<boutique>/apps/bon-commande/* arrive ici (signature Shopify vérifiée).
 * Le bon de commande passe par le paiement normal de Shopify : un pro rattaché à une entreprise
 * avec « paiement à 30 jours » valide sa commande sans payer. Ce lien mène donc simplement au panier.
 */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<Response> => {
  await authenticate.public.appProxy(request);
  return redirect("/cart");
};

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  await authenticate.public.appProxy(request);
  return redirect("/cart");
};
