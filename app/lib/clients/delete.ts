/**
 * Supprimer un client depuis sa fiche (logique pure). Shopify n'efface que les clients sans commande :
 * un client qui a déjà commandé garde sa fiche pour les factures et la comptabilité.
 */

export type DeleteClientResult =
  | { readonly ok: true; readonly intent: "supprimer"; readonly name: string }
  | { readonly ok: false; readonly intent: "supprimer"; readonly message: string };

export interface CompanyProfile {
  readonly contactId: string;
  readonly companyId: string;
  readonly orders: number;
  readonly contacts: number;
}

/** L'entreprise d'un client pro est effacée avec lui si elle n'a ni commande ni autre contact ; sinon on le retire seulement. */
export function companyCleanup(profile: CompanyProfile): "entreprise" | "contact" {
  return profile.orders === 0 && profile.contacts <= 1 ? "entreprise" : "contact";
}

export function cannotDeleteMessage(orders: number): string {
  return `Ce client a déjà passé ${orders} commande${orders > 1 ? "s" : ""} : on ne peut pas l’effacer, sa fiche est gardée pour les factures et la comptabilité.`;
}

/** Message affiché sur la liste des clients après la suppression. */
export function deletedMessage(name: string): string {
  return `« ${name} » a été supprimé.`;
}
