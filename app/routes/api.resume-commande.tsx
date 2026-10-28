import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logError } from "../lib/core/logger.server";
import { loadOrderSummary } from "../lib/agenda/summary.server";

/**
 * Résumé BluePoint d'une commande, demandé par le cadre « BluePoint » de la page de commande Shopify
 * (extension d'admin `commande-bluepoint`). Jeton de session dans l'en-tête Authorization ; en-têtes CORS ajoutés.
 */

export const loader = async ({ request }: LoaderFunctionArgs): Promise<Response> => {
  const { admin, session, cors } = await authenticate.admin(request);
  const orderId = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const summary = await loadOrderSummary(admin, session.shop, orderId, new Date());
    return cors(summary === null ? Response.json({ error: "introuvable" }, { status: 404 }) : Response.json(summary));
  } catch (error) {
    logError("Résumé de commande impossible", error, { orderId });
    return cors(Response.json({ error: "indisponible" }, { status: 503 }));
  }
};

// Requête OPTIONS (pré-vérification CORS) : `authenticate.admin` y répond lui-même.
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { cors } = await authenticate.admin(request);
  return cors(new Response(null, { status: 405 }));
};
