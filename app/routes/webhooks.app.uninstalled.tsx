import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logError, logInfo } from "../lib/core/logger.server";

/**
 * App désinstallée : on supprime les sessions de la boutique.
 * Le webhook peut arriver plusieurs fois, même après une première suppression.
 */
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { shop, session, topic } = await authenticate.webhook(request);
  logInfo("Webhook reçu", { topic, shop });

  if (!session) return new Response(null, { status: 200 });

  try {
    await db.session.deleteMany({ where: { shop } });
  } catch (error) {
    logError("Suppression des sessions impossible", error, { shop });
    // 500 : Shopify réessaiera plus tard.
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
};
