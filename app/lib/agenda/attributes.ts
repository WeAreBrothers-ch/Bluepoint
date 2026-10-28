import { parseIsoDate, type IsoDate } from "../metafields/definitions";

/**
 * Repli quand la commande n'a pas de métachamp de date : attributs de panier
 * posés par le thème (« note attributes » de la commande).
 */

export const CART_ATTRIBUTE_KEYS = {
  requestedDate: "Date de livraison souhaitée",
  deadline: "Livrer au plus tard",
} as const;

export interface OrderAttribute {
  readonly key: string;
  readonly value: string | null;
}

const SWISS_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/** Accepte « 2026-10-21 » ou « 21.10.2026 » ; toute autre forme est ignorée. */
export function parseLooseDate(value: string | null | undefined): IsoDate | null {
  const trimmed = value?.trim() ?? "";
  const iso = parseIsoDate(trimmed);
  if (iso !== null) return iso;
  const parts = SWISS_DATE.exec(trimmed);
  if (parts === null) return null;
  const [, day = "", month = "", year = ""] = parts;
  return parseIsoDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}

function normalizeKey(key: string): string {
  return key.trim().toLocaleLowerCase("fr-CH").replace(/[’']/g, "'");
}

/** Valeur d'un attribut, sans tenir compte de la casse ni des espaces autour de la clé. */
export function findAttribute(attributes: readonly OrderAttribute[], key: string): string | null {
  const wanted = normalizeKey(key);
  return attributes.find((attribute) => normalizeKey(attribute.key) === wanted)?.value ?? null;
}
