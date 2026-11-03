import type { MessageLine } from "./messages";

/**
 * Lignes de la commande pour le récapitulatif des messages
 * (requête vérifiée sur le schéma Admin 2026-10).
 * `currentQuantity` : quantité après les modifications de commande (une ligne retirée vaut 0).
 */

export const ORDER_LINES_QUERY = `#graphql
query LignesFacture($id: ID!) {
  order(id: $id) {
    lineItems(first: 100) {
      nodes { title variantTitle currentQuantity }
    }
  }
}`;

export interface OrderLineNode {
  readonly title: string;
  readonly variantTitle: string | null;
  readonly currentQuantity: number;
}

export interface OrderLinesData {
  readonly order: { readonly lineItems: { readonly nodes: readonly OrderLineNode[] } } | null;
}

/** Titre Shopify des produits sans déclinaison : on ne l'affiche pas. */
const DEFAULT_VARIANT = "Default Title";

export function toMessageLines(nodes: readonly OrderLineNode[]): MessageLine[] {
  return nodes
    .filter((node) => node.currentQuantity > 0)
    .map((node) => {
      const variant = node.variantTitle?.trim() ?? "";
      const label = variant === "" || variant === DEFAULT_VARIANT ? node.title.trim() : `${node.title.trim()} — ${variant}`;
      return { quantity: node.currentQuantity, label };
    });
}
