import { SHOPIFY_ORDER_INVOICE_QUERY, type ShopifyOrderForInvoice } from "@bluepoint/facture-qr";
import type { OrderPaymentFacts } from "./order-payment";

/** Requête de la facture : celle du paquet `facture-qr`, vérifiée sur le schéma Admin 2026-10. */
export const INVOICE_ORDER_QUERY = SHOPIFY_ORDER_INVOICE_QUERY;

export interface InvoiceOrderData {
  readonly order: ShopifyOrderForInvoice | null;
}

/**
 * Coordonnées pour l'envoi, dates d'expédition (date de livraison sur la facture) et paiement
 * (une commande déjà payée reçoit une facture acquittée, sans QR-facture).
 */
export const INVOICE_CONTACT_QUERY = `#graphql
query ContactFacture($id: ID!) {
  order(id: $id) {
    tags
    email
    phone
    customer {
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
      tags
    }
    dateSouhaitee: metafield(namespace: "$app", key: "livraison_date_souhaitee") { value }
    shippingAddress { phone }
    billingAddress { phone }
    fulfillments(first: 20) { status createdAt deliveredAt }
    displayFinancialStatus
    transactions(first: 20) { kind status processedAt gateway }
  }
}`;

export interface InvoiceFulfillment {
  readonly status: string;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
}

/** Coordonnées du client sur la commande. */
export interface InvoiceContactDetails {
  readonly email: string | null;
  readonly phone: string | null;
  readonly customer: {
    readonly defaultEmailAddress: { readonly emailAddress: string } | null;
    readonly defaultPhoneNumber: { readonly phoneNumber: string } | null;
    /** Étiquettes du client (« fictif » : client d'essai, même quand la commande n'est pas étiquetée). */
    readonly tags?: readonly string[];
  } | null;
  readonly shippingAddress: { readonly phone: string | null } | null;
  readonly billingAddress: { readonly phone: string | null } | null;
  readonly fulfillments: readonly InvoiceFulfillment[];
}

export interface InvoiceContactOrder extends InvoiceContactDetails, OrderPaymentFacts {
  /** Étiquettes de la commande (« fictif » : commande d'essai). */
  readonly tags: readonly string[];
  /** Jour de livraison choisi au panier ou dans l'agenda (AAAA-MM-JJ), s'il y en a un. */
  readonly dateSouhaitee?: { readonly value: string } | null;
}

export interface InvoiceContactData {
  readonly order: InvoiceContactOrder | null;
}
