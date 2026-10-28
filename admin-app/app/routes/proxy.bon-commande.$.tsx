import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * Proxy d'app : https://<boutique>/apps/bon-commande/* arrive ici.
 * La signature Shopify est vérifiée (sinon la librairie répond 400).
 * Le bon de commande n'est pas encore disponible : réponse 501.
 */

function notImplemented(): Response {
  return new Response("Bon de commande bientôt disponible.", {
    status: 501,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<Response> => {
  await authenticate.public.appProxy(request);
  return notImplemented();
};

export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  await authenticate.public.appProxy(request);
  return notImplemented();
};
