import { findAttribute, parseLooseDate, type OrderAttribute } from "../agenda/attributes";
import { normalizeSearch } from "../commande/catalog";
import { dateMetafield, forOwner, modeMetafield, type MetafieldValueInput, type OrderMetafieldsSetInput } from "../commande/payload";
import {
  DELIVERY_MODES,
  DELIVERY_MODE_LABELS,
  LIVRAISON_KEYS,
  type DeliveryMode,
  type IsoDate,
  type LivraisonKey,
} from "../metafields/definitions";

/**
 * Commande passée sur la boutique : le thème pose des attributs de panier
 * (« note attributes »). On les recopie dans les métachamps `$app` pour l'agenda et les filtres.
 * Logique pure : les valeurs illisibles sont écartées (et signalées), jamais devinées.
 */

export const CART_DELIVERY_ATTRIBUTES = {
  requestedDate: "Date de livraison souhaitée",
  deadline: "Livrer au plus tard",
  mode: "Mode de livraison",
} as const;

export interface IgnoredAttribute {
  readonly attribute: string;
  readonly reason: "date_illisible" | "mode_inconnu" | "limite_avant_souhaitee";
}

export interface CartDelivery {
  readonly requestedDate: IsoDate | null;
  readonly deadline: IsoDate | null;
  readonly mode: DeliveryMode | null;
  readonly ignored: readonly IgnoredAttribute[];
}

/** « livraison », « Poste », « Retrait sur place »… → mode connu, sinon `null`. */
export function parseDeliveryMode(raw: string): DeliveryMode | null {
  const value = normalizeSearch(raw);
  return DELIVERY_MODES.find((mode) => mode === value || normalizeSearch(DELIVERY_MODE_LABELS[mode]) === value) ?? null;
}

function present(value: string | null): value is string {
  return value !== null && value.trim() !== "";
}

export function readCartDelivery(attributes: readonly OrderAttribute[]): CartDelivery {
  const ignored: IgnoredAttribute[] = [];
  const rawRequested = findAttribute(attributes, CART_DELIVERY_ATTRIBUTES.requestedDate);
  const rawDeadline = findAttribute(attributes, CART_DELIVERY_ATTRIBUTES.deadline);
  const rawMode = findAttribute(attributes, CART_DELIVERY_ATTRIBUTES.mode);

  const requestedDate = present(rawRequested) ? parseLooseDate(rawRequested) : null;
  if (present(rawRequested) && requestedDate === null) {
    ignored.push({ attribute: CART_DELIVERY_ATTRIBUTES.requestedDate, reason: "date_illisible" });
  }
  let deadline = present(rawDeadline) ? parseLooseDate(rawDeadline) : null;
  if (present(rawDeadline) && deadline === null) {
    ignored.push({ attribute: CART_DELIVERY_ATTRIBUTES.deadline, reason: "date_illisible" });
  }
  if (deadline !== null && requestedDate !== null && deadline < requestedDate) {
    ignored.push({ attribute: CART_DELIVERY_ATTRIBUTES.deadline, reason: "limite_avant_souhaitee" });
    deadline = null;
  }
  const mode = present(rawMode) ? parseDeliveryMode(rawMode) : null;
  if (present(rawMode) && mode === null) ignored.push({ attribute: CART_DELIVERY_ATTRIBUTES.mode, reason: "mode_inconnu" });

  // « Livrer au plus tard » absent : par défaut, le jour souhaité (souhaitée + 0 jour).
  return { requestedDate, deadline: deadline ?? requestedDate, mode, ignored };
}

export type ExistingDeliveryMetafields = Readonly<Record<LivraisonKey, boolean>>;

function valuesFor(delivery: CartDelivery): MetafieldValueInput[] {
  const values: MetafieldValueInput[] = [];
  if (delivery.requestedDate !== null) values.push(dateMetafield(LIVRAISON_KEYS.dateSouhaitee, delivery.requestedDate));
  if (delivery.deadline !== null) values.push(dateMetafield(LIVRAISON_KEYS.dateLimite, delivery.deadline));
  if (delivery.mode !== null) values.push(modeMetafield(delivery.mode));
  return values;
}

/**
 * Métachamps à poser : seulement ceux lus dans le panier ET encore absents de la commande.
 * Un métachamp déjà présent (saisi dans l'admin, copié du panier) n'est jamais écrasé.
 */
export function metafieldsToSet(
  orderId: string,
  delivery: CartDelivery,
  existing: ExistingDeliveryMetafields,
): OrderMetafieldsSetInput[] {
  const missing = valuesFor(delivery).filter((metafield) => !existing[metafield.key]);
  return forOwner(orderId, missing);
}
