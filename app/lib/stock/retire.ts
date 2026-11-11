import { parseGid } from "../shopify/ids";
import { bottles, cartonsText, type StockItem } from "./stock";

/**
 * « Retirer ce vin de la vente » et « Remettre en vente », depuis la page Stock (logique pure).
 * Le vin n'est jamais effacé : il est archivé dans Shopify. Il disparaît du site, de « Prendre une commande »
 * et de la liste du stock, mais ses ventes passées gardent leur sorte, leur pays et leur contenance
 * (factures, litres vendus). On peut le remettre en vente à tout moment.
 */

export const RETIRE_INTENTS = ["retirer", "remettre"] as const;
export type RetireIntent = (typeof RETIRE_INTENTS)[number];

export function isRetireIntent(value: unknown): value is RetireIntent {
  return RETIRE_INTENTS.some((intent) => intent === value);
}

export interface RetireResult {
  readonly ok: boolean;
  readonly intent: RetireIntent;
  readonly message: string;
}

/** Un vin retiré de la vente, affiché en bas de la page Stock. */
export interface RetiredWine {
  readonly productId: string;
  readonly title: string;
  readonly imageUrl: string | null;
}

export type ParsedRetire =
  | { readonly ok: true; readonly intent: RetireIntent; readonly productId: string; readonly title: string }
  | { readonly ok: false; readonly intent: RetireIntent; readonly message: string };

export function parseRetire(form: FormData): ParsedRetire {
  const rawIntent = form.get("intent");
  const intent: RetireIntent = isRetireIntent(rawIntent) ? rawIntent : "retirer";
  const rawId = form.get("productId");
  const productId = typeof rawId === "string" ? parseGid(rawId, "Product") : null;
  const rawTitle = form.get("title");
  const title = typeof rawTitle === "string" && rawTitle.trim() !== "" ? rawTitle.trim() : "ce vin";
  if (!isRetireIntent(rawIntent) || productId === null) return { ok: false, intent, message: "Ça n’a pas marché. Rechargez la page, puis réessayez." };
  return { ok: true, intent, productId, title };
}

/** Ce qu'il faut savoir avant de retirer un vin : ce qui reste en cave, ce qui est réservé. */
export function retireWarnings(item: Pick<StockItem, "onHand" | "committed">): string[] {
  const warnings: string[] = [];
  if (item.onHand > 0) warnings.push(`Il reste ${cartonsText(item.onHand)} en cave : ils ne seront plus proposés à la vente.`);
  if (item.committed > 0) {
    warnings.push(`${bottles(item.committed)} ${item.committed > 1 ? "sont réservées" : "est réservée"} pour des commandes pas encore livrées : ces commandes restent à livrer.`);
  }
  return warnings;
}

export function retireMessage(intent: RetireIntent, title: string): string {
  return intent === "retirer"
    ? `« ${title} » est retiré de la vente. Vous le retrouvez en bas de la page, dans « Vins retirés de la vente ».`
    : `« ${title} » est de nouveau en vente, sur le site et dans « Prendre une commande ».`;
}
