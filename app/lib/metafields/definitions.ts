/**
 * Métachamps de commande « livraison ».
 *
 * Les définitions sont DÉCLARÉES dans shopify.app.toml (`[order.metafields.app.livraison_*]`)
 * et créées par Shopify à chaque `shopify app deploy` : aucun code de création ici.
 * Ce fichier ne fait que refléter ces déclarations pour les lire et les écrire
 * avec le bon espace de noms et les bons types. Toute modification doit être
 * faite aux deux endroits.
 */

/**
 * Espace de noms réservé à l'app (`$app`) : Shopify n'accepte les définitions déclarées
 * dans le TOML que dans cet espace. Les clés portent donc le préfixe « livraison_ ».
 */
export const LIVRAISON_NAMESPACE = "$app";

export const LIVRAISON_KEYS = {
  dateSouhaitee: "livraison_date_souhaitee",
  dateLimite: "livraison_date_limite",
  mode: "livraison_mode",
} as const;

export type LivraisonKey = (typeof LIVRAISON_KEYS)[keyof typeof LIVRAISON_KEYS];

/** Valeurs autorisées du métachamp `mode` (validations.choices dans le TOML). */
export const DELIVERY_MODES = ["livraison", "poste", "retrait"] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_MODE_LABELS: Readonly<Record<DeliveryMode, string>> = {
  livraison: "Livraison BluePoint",
  poste: "Envoi par la Poste",
  retrait: "Retrait sur place",
};

export function isDeliveryMode(value: unknown): value is DeliveryMode {
  return typeof value === "string" && (DELIVERY_MODES as readonly string[]).includes(value);
}

/** Date calendaire au format Shopify `date` (AAAA-MM-JJ, sans heure ni fuseau). */
export type IsoDate = string & { readonly __format: "AAAA-MM-JJ" };

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : (value as IsoDate);
}
