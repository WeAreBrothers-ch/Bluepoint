import { shortDay, swissIsoDate } from "../agenda/dates";
import { scheduleAll } from "../agenda/grouping";
import { deliveryDateText } from "../agenda/labels";
import { orderToTask } from "../agenda/mapping";
import type { AgendaOrderNode } from "../agenda/query";
import type { ScheduledTask } from "../agenda/types";
import type { IsoDate } from "../metafields/definitions";

/**
 * Liste des commandes : retrouver une commande passée, par client, par numéro ou par état,
 * sans ouvrir les menus de Shopify. Chaque ligne ouvre la fiche commande de l'app.
 */

export type OrdersTab = "toutes" | "a_livrer" | "livrees" | "annulees";

export const ORDERS_TABS: readonly { readonly id: OrdersTab; readonly label: string; readonly search: string }[] = [
  { id: "toutes", label: "Toutes", search: "" },
  { id: "a_livrer", label: "À livrer", search: "status:open AND -status:cancelled AND -fulfillment_status:fulfilled" },
  { id: "livrees", label: "Livrées", search: "fulfillment_status:fulfilled AND -status:cancelled" },
  { id: "annulees", label: "Annulées", search: "status:cancelled" },
];

export const DEFAULT_ORDERS_TAB: OrdersTab = "toutes";

export function isOrdersTab(value: unknown): value is OrdersTab {
  return ORDERS_TABS.some((tab) => tab.id === value);
}

/** Nombre de commandes affichées par page. */
export const ORDERS_PAGE_SIZE = 20;

const MAX_TERM_LENGTH = 60;

/** Ce que la personne a tapé, débarrassé de ce qui a un sens dans la recherche de Shopify. */
export function cleanSearchTerm(raw: string): string {
  return raw.replace(/["'\\():<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_TERM_LENGTH);
}

/**
 * Recherche envoyée à Shopify : l'onglet choisi, plus ce qui a été tapé.
 * Un numéro (« 1051 » ou « #1051 ») cherche la commande ; sinon le texte cherche partout
 * (nom du client, entreprise, ville, e-mail…).
 */
export function ordersSearchQuery(tab: OrdersTab, rawTerm: string): string {
  const base = ORDERS_TABS.find((candidate) => candidate.id === tab)?.search ?? "";
  const term = cleanSearchTerm(rawTerm);
  const digits = /^#?(\d{1,8})$/.exec(term);
  const text = term === "" ? "" : digits === null ? term : `name:${digits[1]}`;
  return [base, text].filter((part) => part !== "").join(" AND ");
}

/** Une commande de la liste : la tâche de l'agenda (vins, total, paiement, état) plus ce qu'il faut pour une liste. */
export interface OrderListItem {
  readonly task: ScheduledTask;
  readonly cancelled: boolean;
  /** « Passée le 2 novembre ». */
  readonly orderedLabel: string;
  /** Où en est la livraison, en une phrase (jamais vide). */
  readonly deliveryLine: string;
}

export interface OrderListNode extends AgendaOrderNode {
  readonly createdAt: string;
}

function deliveryLine(task: ScheduledTask, cancelled: boolean, today: IsoDate): string {
  if (cancelled) return "Commande annulée";
  if (task.status === "livree") return task.deliveredOn === null ? "Déjà livrée" : `Livrée le ${shortDay(task.deliveredOn)}`;
  if (task.status === "expediee") return "En route vers le client";
  return deliveryDateText(task, today);
}

/** `null` seulement si l'identifiant de la commande est illisible. */
export function toOrderListItem(node: OrderListNode, today: IsoDate): OrderListItem | null {
  const cancelled = node.cancelledAt !== null;
  // `orderToTask` ignore les commandes annulées : on lui donne la commande comme si elle ne l'était pas.
  const base = orderToTask({ ...node, cancelledAt: null });
  if (base === null) return null;
  const [task] = scheduleAll([base], today);
  if (task === undefined) return null;
  const orderedOn = swissIsoDate(new Date(node.createdAt));
  return { task, cancelled, orderedLabel: `Passée le ${shortDay(orderedOn)}`, deliveryLine: deliveryLine(task, cancelled, today) };
}

/** Adresse de la liste pour un onglet, une recherche et une page. */
export function ordersHref(tab: OrdersTab, term: string, cursor: string | null = null): string {
  const params = new URLSearchParams();
  if (tab !== DEFAULT_ORDERS_TAB) params.set("onglet", tab);
  const clean = cleanSearchTerm(term);
  if (clean !== "") params.set("q", clean);
  if (cursor !== null) params.set("apres", cursor);
  const query = params.toString();
  return query === "" ? "/app/commandes" : `/app/commandes?${query}`;
}
