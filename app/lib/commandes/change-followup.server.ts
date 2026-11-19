import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { frenchTypography } from "../abaninja/trial-typography";
import { cancelSaleNote, syncSaleNote, type FollowOutcome } from "../abaninja/vente-bon-suivi.server";
import { logError } from "../core/logger.server";
import { parseGid } from "../shopify/ids";
import type { OrderChangeResult } from "./change";
import { handleOrderChange } from "./change.server";

/**
 * « Modifier les vins » et « Annuler la commande », puis le bon de livraison AbaNinja suit.
 * Le changement Shopify compte d'abord : si le bon ne suit pas, la commande reste changée et le message le dit.
 */

const DONE: Readonly<Record<"modifier" | "annuler", string>> = {
  modifier: "Le bon de livraison AbaNinja est à jour.",
  annuler: "Le bon de livraison AbaNinja est annulé.",
};

function followUpText(intent: "modifier" | "annuler", outcome: FollowOutcome): string | null {
  if (outcome.kind === "rien") return null;
  if (outcome.kind === "fait") return DONE[intent];
  return frenchTypography(`Le bon de livraison AbaNinja n’a pas suivi : ${outcome.message}`);
}

async function follow(admin: AdminApiContext, shop: string, intent: "modifier" | "annuler", orderId: string): Promise<FollowOutcome> {
  const gid = parseGid(orderId, "Order");
  if (gid === null) return { kind: "rien" };
  try {
    return intent === "modifier" ? await syncSaleNote(admin, shop, gid) : await cancelSaleNote(shop, gid);
  } catch (error) {
    logError("Suivi du bon de livraison AbaNinja impossible", error, { orderId });
    return { kind: "echec", message: "l’app n’a pas pu le mettre à jour. Corrigez-le dans AbaNinja." };
  }
}

export async function handleOrderChangeWithSale(admin: AdminApiContext, shop: string, form: FormData): Promise<OrderChangeResult> {
  const result = await handleOrderChange(admin, form);
  const orderId = form.get("orderId");
  if (!result.ok || typeof orderId !== "string") return result;
  const extra = followUpText(result.intent, await follow(admin, shop, result.intent, orderId));
  return extra === null ? result : { ...result, message: `${result.message} ${extra}` };
}
