import { isPrivateCustomersCard, type AbaNinjaCard } from "./cards";
import { namesMatch } from "./normalize";
import type { ShopifyClient, ShopifySide } from "./shopify-client";

/**
 * Range chaque fiche AbaNinja : déjà reliée, ignorée, même e-mail (un seul client possible), à vérifier
 * (nom ou téléphone proche, ou e-mail partagé), ou absente de la boutique. Logique pure, sans écriture.
 */

export type MatchReason = "email" | "nom" | "telephone";

export interface Candidate {
  readonly client: ShopifyClient;
  readonly reasons: readonly MatchReason[];
}

export type CardStatus =
  | { readonly kind: "relie"; readonly card: AbaNinjaCard; readonly client: ShopifyClient }
  | { readonly kind: "ignore"; readonly card: AbaNinjaCard; readonly auto: boolean }
  | { readonly kind: "meme_email"; readonly card: AbaNinjaCard; readonly candidate: Candidate }
  | { readonly kind: "a_verifier"; readonly card: AbaNinjaCard; readonly candidates: readonly Candidate[] }
  | {
      readonly kind: "absent";
      readonly card: AbaNinjaCard;
      /** E-mail à donner au nouveau client (le premier libre), null si aucun. */
      readonly email: string | null;
      /** Client qui porte déjà l'e-mail de la fiche, quand aucun n'est libre. */
      readonly blockedBy: string | null;
      /** Téléphone à reprendre, null s'il manque ou appartient déjà à un client. */
      readonly phone: string | null;
    };

const MAX_CANDIDATES = 3;

function isTaken(client: ShopifyClient): boolean {
  return client.link !== null || client.companyLink !== null;
}

function isEligible(card: AbaNinjaCard, client: ShopifyClient): boolean {
  return !isTaken(client) && !client.refused.includes(card.uuid);
}

function cardNames(card: AbaNinjaCard): string[] {
  const contact = [card.firstName, card.lastName].filter(Boolean).join(" ");
  return contact === "" || card.kind === "person" ? [card.name] : [card.name, contact];
}

function reasonsFor(card: AbaNinjaCard, client: ShopifyClient): MatchReason[] {
  const reasons: MatchReason[] = [];
  if (client.email !== null && card.emails.includes(client.email)) reasons.push("email");
  if (cardNames(card).some((name) => client.names.some((other) => namesMatch(name, other)))) reasons.push("nom");
  if (card.phone !== null && client.phone === card.phone) reasons.push("telephone");
  return reasons;
}

function candidatesFor(card: AbaNinjaCard, clients: readonly ShopifyClient[]): Candidate[] {
  return clients
    .filter((client) => isEligible(card, client))
    .map((client) => ({ client, reasons: reasonsFor(card, client) }))
    .filter((candidate) => candidate.reasons.length > 0);
}

function ranked(candidates: readonly Candidate[]): Candidate[] {
  return [...candidates].sort((a, b) => b.reasons.length - a.reasons.length).slice(0, MAX_CANDIDATES);
}

function absent(card: AbaNinjaCard, clients: readonly ShopifyClient[]): CardStatus {
  const used = new Set(clients.map((client) => client.email).filter((email): email is string => email !== null));
  const email = card.emails.find((candidate) => !used.has(candidate)) ?? null;
  const holder = email === null ? clients.find((client) => client.email !== null && card.emails.includes(client.email)) : undefined;
  const phoneTaken = card.phone !== null && clients.some((client) => client.phone === card.phone);
  return { kind: "absent", card, email, blockedBy: holder?.displayName ?? null, phone: phoneTaken ? null : card.phone };
}

/** Clients Shopify qui sont le seul « même e-mail » de plus d'une fiche : à vérifier, jamais reliés d'un clic. */
function contestedClients(cards: readonly AbaNinjaCard[], clients: readonly ShopifyClient[]): Set<string> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const hits = candidatesFor(card, clients).filter((candidate) => candidate.reasons.includes("email"));
    const only = hits.length === 1 ? hits[0] : undefined;
    if (only !== undefined) counts.set(only.client.customerId, (counts.get(only.client.customerId) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
}

export function compareCards(cards: readonly AbaNinjaCard[], side: ShopifySide): CardStatus[] {
  const owners = new Map<string, ShopifyClient>();
  for (const client of side.clients) {
    for (const link of [client.link, client.companyLink]) {
      if (link !== null && !owners.has(link.uuid)) owners.set(link.uuid, client);
    }
  }
  const ignored = new Set(side.ignored);
  const contested = contestedClients(cards, side.clients);
  return cards.map((card): CardStatus => {
    const owner = owners.get(card.uuid);
    if (owner !== undefined) return { kind: "relie", card, client: owner };
    if (isPrivateCustomersCard(card)) return { kind: "ignore", card, auto: true };
    if (ignored.has(card.uuid)) return { kind: "ignore", card, auto: false };
    const candidates = candidatesFor(card, side.clients);
    const byEmail = candidates.filter((candidate) => candidate.reasons.includes("email"));
    const sole = byEmail.length === 1 ? byEmail[0] : undefined;
    if (sole !== undefined && !contested.has(sole.client.customerId)) return { kind: "meme_email", card, candidate: sole };
    const toCheck = byEmail.length > 0 ? byEmail : candidates;
    return toCheck.length > 0 ? { kind: "a_verifier", card, candidates: ranked(toCheck) } : absent(card, side.clients);
  });
}

export function findStatus(statuses: readonly CardStatus[], uuid: string): CardStatus | undefined {
  return statuses.find((status) => status.card.uuid === uuid);
}
