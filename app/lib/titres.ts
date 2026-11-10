/**
 * Les noms des pages de l'application : une seule liste, pour que le menu, les titres, les boutons et les phrases d'aide
 * disent toujours la même chose. Écrits pour être compris tout de suite par le patron comme par quelqu'un qui travaille
 * pour lui : un nom de chose (jamais « mes… »), des mots de tous les jours.
 */

export const TITRES = {
  livraisons: "Livraisons",
  nouvelleCommande: "Prendre une commande",
  factures: "Factures",
  vins: "Vins en cave",
  clients: "Clients",
  commandes: "Toutes les commandes",
  entreprise: "Informations de l’entreprise",
  aide: "Aide",
  abaninja: "Connexion AbaNinja",
} as const;

/** « Livraisons » entre guillemets français, pour les phrases (« Touchez « Livraisons » »). */
export function entreGuillemets(titre: string): string {
  return `« ${titre} »`;
}
