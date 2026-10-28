/**
 * Identifiants globaux Shopify (GID), ex. « gid://shopify/Order/123 ».
 * Un type marqué évite de confondre un GID avec une chaîne quelconque.
 */

export type ShopifyGid<TResource extends string = string> = string & {
  readonly __resource: TResource;
};

export type OrderGid = ShopifyGid<"Order">;

const GID_PATTERN = /^gid:\/\/shopify\/([A-Za-z]+)\/(\d+)$/;

/** Valide une chaîne et la transforme en GID de la ressource attendue, sinon `null`. */
export function parseGid<TResource extends string>(
  value: string,
  resource: TResource,
): ShopifyGid<TResource> | null {
  const match = GID_PATTERN.exec(value);
  return match !== null && match[1] === resource ? (value as ShopifyGid<TResource>) : null;
}

/** Partie numérique d'un GID (utile pour construire un lien vers l'admin). */
export function gidToNumericId(gid: ShopifyGid): string {
  return gid.slice(gid.lastIndexOf("/") + 1);
}
