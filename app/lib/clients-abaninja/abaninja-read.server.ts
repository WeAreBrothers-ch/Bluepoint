import { logInfo } from "../core/logger.server";
import { success, type Result } from "../core/result";
import type { CallOptions } from "../abaninja/call-options";
import type { AbaNinjaConfig } from "../abaninja/config.server";
import type { AbaNinjaError } from "../abaninja/errors";
import { abaNinjaRequest } from "../abaninja/http.server";
import { abaNinjaPageSchema } from "./abaninja-schema";
import { toCard, type AbaNinjaCard } from "./cards";
import type { CardKind } from "./link";

/**
 * Toutes les fiches clients d'AbaNinja (sociétés puis personnes), en lecture seule, page par page.
 * Plafond de 20 pages de 100 par type : au-delà, la liste est signalée comme coupée.
 */

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const LIST_PATHS: Readonly<Record<CardKind, string>> = { company: "companies", person: "persons" };

export interface CardsListing {
  readonly cards: readonly AbaNinjaCard[];
  /** Fiches illisibles ou sans nom, laissées de côté. */
  readonly skipped: number;
  readonly truncated: boolean;
}

interface KindListing {
  readonly cards: AbaNinjaCard[];
  readonly skipped: number;
  readonly truncated: boolean;
}

async function listKind(config: AbaNinjaConfig, kind: CardKind, options: CallOptions): Promise<Result<KindListing, AbaNinjaError>> {
  const cards: AbaNinjaCard[] = [];
  let skipped = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await abaNinjaRequest({
      ...options,
      config,
      method: "GET",
      path: ["accounts", { uuid: config.accountUuid }, "addresses", "v2", LIST_PATHS[kind]],
      query: { page, limit: PAGE_SIZE },
      schema: abaNinjaPageSchema,
    });
    if (!result.ok) return result;
    for (const item of result.value.data) {
      const card = toCard(item, kind);
      if (card === null) skipped += 1;
      else cards.push(card);
    }
    const lastPage = result.value.meta?.last_page ?? null;
    const done = lastPage === null ? result.value.data.length < PAGE_SIZE : page >= lastPage;
    if (done) return success({ cards, skipped, truncated: false });
  }
  return success({ cards, skipped, truncated: true });
}

export async function listAbaNinjaCards(config: AbaNinjaConfig, options: CallOptions = {}): Promise<Result<CardsListing, AbaNinjaError>> {
  const companies = await listKind(config, "company", options);
  if (!companies.ok) return companies;
  const persons = await listKind(config, "person", options);
  if (!persons.ok) return persons;
  const listing: CardsListing = {
    cards: [...companies.value.cards, ...persons.value.cards],
    skipped: companies.value.skipped + persons.value.skipped,
    truncated: companies.value.truncated || persons.value.truncated,
  };
  logInfo("Fiches AbaNinja lues", { fiches: listing.cards.length, sautees: listing.skipped, coupee: listing.truncated });
  return success(listing);
}
