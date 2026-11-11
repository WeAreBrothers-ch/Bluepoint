/**
 * Les noms des pages de l'application : une seule liste, pour que le menu, les titres, les boutons et les phrases d'aide
 * disent toujours la même chose. Écrits pour être compris tout de suite par le patron comme par quelqu'un qui travaille
 * pour lui : un nom de chose (jamais « mes… »), des mots de tous les jours.
 */

export const TITRES = {
  livraisons: "Livraisons",
  nouvelleCommande: "Prendre une commande",
  factures: "Factures",
  vins: "Stock",
  litres: "Litres vendus",
  clients: "Clients",
  clientsPro: "Clients pro",
  commandes: "Toutes les commandes",
  entreprise: "Informations de l’entreprise",
  aide: "Aide",
  abaninja: "Connexion AbaNinja",
} as const;

/** Quand une fonction attend encore une autorisation dans Shopify : le patron n'a rien à faire lui-même. */
export const PAS_ENCORE_ACTIVE = "Cette fonction n’est pas encore activée. Appelez la personne qui s’occupe de l’application.";

/** Lien vers les informations de l'entreprise, le même partout où il en manque. */
export const COMPLETER_ENTREPRISE = "Compléter les informations de l’entreprise";

/** Bande bleue des demandes pour devenir client pro, la même sur toutes les pages. */
export function proRequestsHeading(count: number): string {
  return count > 1 ? `${count} demandes pour devenir client pro` : "1 demande pour devenir client pro";
}

/** « Livraisons » entre guillemets français, pour les phrases (« Touchez « Livraisons » »). */
export function entreGuillemets(titre: string): string {
  return `« ${titre} »`;
}
