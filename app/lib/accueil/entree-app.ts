import { TITRES } from "../titres";

/**
 * Adresses pour rentrer dans l'app depuis la page d'accueil publique (« / ») quand elle s'ouvre sans le nom de la
 * boutique. Deux cas :
 * - dans l'admin Shopify (l'app est dans un cadre) : on recharge la page de l'app avec les paramètres que Shopify
 *   lui donne d'habitude (`embedded`, `shop`, `host`) ; la librairie Shopify va alors chercher la session toute seule ;
 * - hors de l'admin (adresse de l'app ouverte dans un navigateur) : on ouvre l'admin Shopify directement sur la page.
 */

/** Seule forme acceptée : la boutique « xxx.myshopify.com », celle que Shopify garde dans la session. */
const MYSHOPIFY_DOMAIN = /^([a-z0-9][a-z0-9-]*)\.myshopify\.com$/;

export interface ShopEntry {
  /** « 5s71g8-0v.myshopify.com » */
  readonly shop: string;
  /** « 5s71g8-0v » : le nom de la boutique dans les adresses de l'admin Shopify. */
  readonly handle: string;
}

export type EntryIcon = "calendar" | "order" | "receipt" | "product" | "person";

export interface EntryPage {
  readonly path: string;
  readonly label: string;
  readonly icon: EntryIcon;
}

/** Les pages du menu de l'app, dans le même ordre et avec les mêmes noms (voir `app/routes/app.tsx`). */
export const ENTRY_PAGES: readonly EntryPage[] = [
  { path: "/app", label: TITRES.livraisons, icon: "calendar" },
  { path: "/app/commande", label: TITRES.nouvelleCommande, icon: "order" },
  { path: "/app/factures", label: TITRES.factures, icon: "receipt" },
  { path: "/app/stock", label: TITRES.vins, icon: "product" },
  { path: "/app/clients", label: TITRES.clients, icon: "person" },
];

/** Accueil de l'admin Shopify, quand la boutique n'est pas connue : Shopify propose alors ses boutiques. */
export const SHOPIFY_ADMIN_HOME = "https://admin.shopify.com/";

export function shopEntry(shop: string | null): ShopEntry | null {
  if (shop === null) return null;
  const handle = MYSHOPIFY_DOMAIN.exec(shop)?.[1];
  return handle === undefined ? null : { shop, handle };
}

/** Le paramètre `host` que Shopify donne à l'app : « admin.shopify.com/store/<boutique> » en base64, sans « = ». */
export function hostParam(entry: ShopEntry): string {
  return btoa(`admin.shopify.com/store/${entry.handle}`).replace(/=+$/, "");
}

/** Hors de l'admin : la page de l'app ouverte dans l'admin Shopify (connexion Shopify d'abord si besoin). */
export function adminPageUrl(entry: ShopEntry, apiKey: string, path: string): string {
  return `https://admin.shopify.com/store/${entry.handle}/apps/${encodeURIComponent(apiKey)}${path}`;
}

/** Dans l'admin : la page de l'app rechargée dans son cadre, comme Shopify l'ouvre. */
export function framedPageUrl(entry: ShopEntry, path: string): string {
  const params = new URLSearchParams({ embedded: "1", shop: entry.shop, host: hostParam(entry) });
  return `${path}?${params.toString()}`;
}

export interface EntryLink extends EntryPage {
  /** Lien à suivre hors de l'admin Shopify. */
  readonly adminUrl: string;
  /** Lien à suivre dans l'admin Shopify (l'app est dans un cadre). */
  readonly framedUrl: string;
}

/** Un bouton par page du menu ; le premier (« Livraisons ») est aussi la page où l'on revient tout seul. */
export function entryLinks(entry: ShopEntry, apiKey: string): EntryLink[] {
  return ENTRY_PAGES.map((page) => ({
    ...page,
    adminUrl: adminPageUrl(entry, apiKey, page.path),
    framedUrl: framedPageUrl(entry, page.path),
  }));
}
