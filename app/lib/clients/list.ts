import { toCustomerOption } from "../commande/customers";
import type { CustomerNode } from "../commande/queries";
import { decimalToCents } from "../commande/totals";
import type { CustomerOption } from "../commande/types";

/**
 * Liste des clients : retrouver un client (nom, entreprise, téléphone, e-mail, ville), voir ses coordonnées
 * et ses commandes, sans ouvrir les menus de Shopify. Logique pure, testée sans Shopify.
 */

export type ClientsTab = "tous" | "pros";

export const CLIENTS_TABS: readonly { readonly id: ClientsTab; readonly label: string; readonly search: string }[] = [
  { id: "tous", label: "Tous", search: "" },
  { id: "pros", label: "Clients pro", search: "(tag:pro OR tag:professionnel OR tag:b2b)" },
];

export const DEFAULT_CLIENTS_TAB: ClientsTab = "tous";

export function isClientsTab(value: unknown): value is ClientsTab {
  return CLIENTS_TABS.some((tab) => tab.id === value);
}

export const CLIENTS_PAGE_SIZE = 20;

const MAX_TERM_LENGTH = 60;

/** Ce qui a été tapé, débarrassé de ce qui a un sens dans la recherche de Shopify. */
export function cleanClientTerm(raw: string): string {
  return raw.replace(/["'\\:()[\]{}<>!*]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TERM_LENGTH);
}

/** Recherche envoyée à Shopify : l'onglet choisi, plus ce qui a été tapé (cherche partout : nom, entreprise, ville…). */
export function clientsSearchQuery(tab: ClientsTab, rawTerm: string): string {
  const base = CLIENTS_TABS.find((candidate) => candidate.id === tab)?.search ?? "";
  return [base, cleanClientTerm(rawTerm)].filter((part) => part !== "").join(" AND ");
}

/** Adresse de la liste pour un onglet, une recherche et une page. */
export function clientsHref(tab: ClientsTab, term: string, cursor: string | null = null): string {
  const params = new URLSearchParams();
  if (tab !== DEFAULT_CLIENTS_TAB) params.set("onglet", tab);
  const clean = cleanClientTerm(term);
  if (clean !== "") params.set("q", clean);
  if (cursor !== null) params.set("apres", cursor);
  const query = params.toString();
  return query === "" ? "/app/clients" : `/app/clients?${query}`;
}

/** Un client de la liste. */
export interface ClientListItem {
  readonly customer: CustomerOption;
  /** Entreprise (de l'adresse ou du compte pro), ou null pour un particulier. */
  readonly company: string | null;
  readonly ordersCount: number;
  /** Total des achats en centimes de franc, ou null s'il n'est pas en CHF. */
  readonly spentCents: number | null;
}

/** Champs en plus de la fiche client de base, lus pour la liste et la fiche. */
export interface ClientStatsNode extends CustomerNode {
  readonly firstName: string | null;
  readonly lastName: string | null;
  /** Shopify renvoie ce nombre sous forme de texte. */
  readonly numberOfOrders: string;
  readonly amountSpent: { readonly amount: string; readonly currencyCode: string };
}

export const CLIENT_STATS_FIELDS = `
      firstName
      lastName
      numberOfOrders
      amountSpent { amount currencyCode }`;

export function toClientListItem(node: ClientStatsNode): ClientListItem | null {
  const customer = toCustomerOption(node);
  if (customer === null) return null;
  const company = (customer.address?.company?.trim() || customer.b2b[0]?.companyName.trim()) ?? "";
  const count = Number(node.numberOfOrders);
  const spent = node.amountSpent.currencyCode === "CHF" ? decimalToCents(node.amountSpent.amount) : null;
  return { customer, company: company === "" ? null : company, ordersCount: Number.isFinite(count) ? count : 0, spentCents: spent };
}
