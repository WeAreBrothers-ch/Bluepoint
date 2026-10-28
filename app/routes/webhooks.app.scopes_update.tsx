import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { logError, logInfo } from "../lib/core/logger.server";
import { readCurrentScopes } from "../lib/webhooks/payloads";

/** Autorisations modifiées : on met à jour celles enregistrées dans la session. */
export const action = async ({ request }: ActionFunctionArgs): Promise<Response> => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  logInfo("Webhook reçu", { topic, shop });

  const current = readCurrentScopes(payload);
  if (!session || current === null) return new Response(null, { status: 200 });

  try {
    await db.session.update({
      where: { id: session.id },
      data: { scope: current.join(",") },
    });
  } catch (error) {
    logError("Mise à jour des autorisations impossible", error, { shop });
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 200 });
};
