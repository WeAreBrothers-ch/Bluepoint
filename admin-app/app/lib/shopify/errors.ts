/** Erreurs typées renvoyées par les helpers GraphQL de l'app. */

/** Une erreur métier renvoyée par une mutation (champ `userErrors`). */
export interface ShopifyUserError {
  readonly field: readonly string[] | null;
  readonly message: string;
  readonly code?: string | null;
}

/** La requête a échoué (réseau, erreur GraphQL, limite de débit…). */
export class ShopifyRequestError extends Error {
  override readonly name = "ShopifyRequestError";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** La requête a abouti mais Shopify a refusé l'opération (`userErrors`). */
export class ShopifyUserErrors extends Error {
  override readonly name = "ShopifyUserErrors";

  constructor(readonly userErrors: readonly ShopifyUserError[]) {
    super(userErrors.map((userError) => userError.message).join(" · "));
  }
}

export type ShopifyGraphqlError = ShopifyRequestError | ShopifyUserErrors;
