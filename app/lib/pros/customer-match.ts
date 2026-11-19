/**
 * La recherche Shopify `email:"…"` peut renvoyer des clients dont l'e-mail ressemble seulement à celui demandé.
 * Avant de donner le statut pro, on ne garde que le client dont l'e-mail est exactement celui de la demande.
 */

export interface CustomerWithEmail {
  readonly defaultEmailAddress?: { readonly emailAddress: string } | null;
}

export function pickCustomerWithEmail<TCustomer extends CustomerWithEmail>(customers: readonly TCustomer[], email: string): TCustomer | null {
  const wanted = email.trim().toLowerCase();
  return customers.find((customer) => customer.defaultEmailAddress?.emailAddress.trim().toLowerCase() === wanted) ?? null;
}
