/**
 * Essai « bon de livraison → facture » : ce que l'essai lit d'une commande fictive dans Shopify
 * (requêtes en lecture seule, vérifiées sur le schéma Admin 2026-10).
 */

/** Étiquette posée sur toutes les commandes de test : l'essai refuse toute autre commande. */
export const FICTITIOUS_TAG = "fictif";

interface MoneyBag {
  readonly shopMoney: { readonly amount: string };
}

export interface TrialOrderLine {
  readonly title: string;
  readonly variantTitle: string | null;
  readonly quantity: number;
  /** Quantité après « Modifier les vins » (0 = vin retiré). */
  readonly currentQuantity: number;
  readonly originalUnitPriceSet: MoneyBag;
  readonly discountedTotalSet: MoneyBag;
  readonly taxLines: readonly { readonly rate: number }[];
}

export interface TrialOrder {
  readonly id: string;
  readonly name: string;
  readonly tags: readonly string[];
  readonly taxesIncluded: boolean;
  readonly customer: { readonly displayName: string } | null;
  readonly billingAddress: { readonly company: string | null } | null;
  readonly dateSouhaitee: { readonly value: string } | null;
  readonly currentShippingPriceSet: MoneyBag;
  readonly currentTotalDiscountsSet: MoneyBag;
  readonly currentTotalPriceSet: MoneyBag;
  readonly lineItems: { readonly nodes: readonly TrialOrderLine[] };
}

export const TRIAL_ORDER_QUERY = `#graphql
query EssaiBonLivraisonCommande($id: ID!) {
  order(id: $id) {
    id
    name
    tags
    taxesIncluded
    customer { displayName }
    billingAddress { company }
    dateSouhaitee: metafield(namespace: "$app", key: "livraison_date_souhaitee") { value }
    currentShippingPriceSet { shopMoney { amount } }
    currentTotalDiscountsSet { shopMoney { amount } }
    currentTotalPriceSet { shopMoney { amount } }
    lineItems(first: 100) {
      nodes {
        title
        variantTitle
        quantity
        currentQuantity
        originalUnitPriceSet { shopMoney { amount } }
        discountedTotalSet { shopMoney { amount } }
        taxLines { rate }
      }
    }
  }
}`;

export interface TrialOrderData {
  readonly order: TrialOrder | null;
}

/** Une commande fictive proposée dans la liste de la page d'essai. */
export interface FictitiousOrderOption {
  readonly id: string;
  readonly label: string;
}

/** Liste montrée sur la page ; `available` faux : Shopify n'a pas répondu (liste vide par défaut). */
export interface FictitiousOrders {
  readonly available: boolean;
  readonly options: readonly FictitiousOrderOption[];
}

export const FICTITIOUS_ORDERS_QUERY = `#graphql
query EssaiBonLivraisonCommandesFictives {
  orders(first: 25, query: "tag:fictif", sortKey: CREATED_AT, reverse: true) {
    nodes {
      id
      name
      customer { displayName }
      billingAddress { company }
      currentTotalPriceSet { shopMoney { amount } }
    }
  }
}`;

interface FictitiousOrderNode {
  readonly id: string;
  readonly name: string;
  readonly customer: { readonly displayName: string } | null;
  readonly billingAddress: { readonly company: string | null } | null;
  readonly currentTotalPriceSet: MoneyBag;
}

export interface FictitiousOrdersData {
  readonly orders: { readonly nodes: readonly FictitiousOrderNode[] };
}

/** Nom du client tel qu'on l'affiche : l'entreprise d'abord, sinon la personne. */
export function customerLabel(order: Pick<TrialOrder, "billingAddress" | "customer">): string | null {
  const company = order.billingAddress?.company?.trim() ?? "";
  if (company !== "") return company;
  const person = order.customer?.displayName.trim() ?? "";
  return person === "" ? null : person;
}

/** « #1028 · Trattoria Bellavista (fictif) · 738.00 CHF » */
export function toOrderOption(node: FictitiousOrderNode): FictitiousOrderOption {
  const amount = Number(node.currentTotalPriceSet.shopMoney.amount);
  const total = Number.isFinite(amount) ? `${amount.toFixed(2)} CHF` : "";
  const parts = [node.name, customerLabel(node), total].filter((part): part is string => part !== null && part !== "");
  return { id: node.id, label: parts.join(" · ") };
}
