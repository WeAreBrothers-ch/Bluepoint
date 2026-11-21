import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { readAbaNinjaConfig } from "../abaninja/config.server";
import { logError } from "../core/logger.server";
import { failure, success, type Result } from "../core/result";
import { listAbaNinjaCards, type CardsListing } from "./abaninja-read.server";
import { compareCards, type CardStatus } from "./match";
import { loadShopifySide } from "./shopify-read.server";
import type { ShopifySide } from "./shopify-client";

/** Lit AbaNinja et la boutique en même temps, puis range chaque fiche. Sert à la page et à chaque bouton. */

const ABANINJA_BUDGET_MS = 40_000;

export interface Comparison {
  readonly listing: CardsListing;
  readonly side: ShopifySide;
  readonly statuses: readonly CardStatus[];
}

export class ComparisonError extends Error {
  override readonly name = "ComparisonError";
}

export async function loadComparison(admin: AdminApiContext): Promise<Result<Comparison, ComparisonError>> {
  const config = readAbaNinjaConfig();
  if (!config.ok) return failure(new ComparisonError(config.error.message));
  const [listing, side] = await Promise.all([
    listAbaNinjaCards(config.value, { signal: AbortSignal.timeout(ABANINJA_BUDGET_MS) }),
    loadShopifySide(admin),
  ]);
  if (!listing.ok) {
    logError("Clients AbaNinja : lecture d'AbaNinja impossible", listing.error, { code: listing.error.code });
    return failure(
      new ComparisonError(
        `Les fiches d’AbaNinja n’ont pas pu être lues. ${listing.error.message} Si le problème continue, appelez la personne qui s’occupe de l’application.`,
      ),
    );
  }
  if (!side.ok) {
    logError("Clients AbaNinja : lecture des clients de la boutique impossible", side.error);
    return failure(new ComparisonError("Les clients de la boutique n’ont pas pu être lus. Rechargez la page dans un instant."));
  }
  return success({ listing: listing.value, side: side.value, statuses: compareCards(listing.value.cards, side.value) });
}
