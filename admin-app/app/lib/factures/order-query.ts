import { SHOPIFY_ORDER_INVOICE_QUERY, type ShopifyOrderForInvoice } from "@bluepoint/facture-qr";

/** Requête de la facture : celle du paquet `facture-qr`, vérifiée sur le schéma Admin 2026-10. */
export const INVOICE_ORDER_QUERY = SHOPIFY_ORDER_INVOICE_QUERY;

export interface InvoiceOrderData {
  readonly order: ShopifyOrderForInvoice | null;
}

/** Coordonnées pour l'envoi et dates d'expédition (date de livraison sur la facture). */
export const INVOICE_CONTACT_QUERY = `#graphql
query ContactFacture($id: ID!) {
  order(id: $id) {
    email
    phone
    customer {
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
    }
    shippingAddress { phone }
    billingAddress { phone }
    fulfillments(first: 20) { status createdAt deliveredAt }
  }
}`;

export interface InvoiceFulfillment {
  readonly status: string;
  readonly createdAt: string;
  readonly deliveredAt: string | null;
}

export interface InvoiceContactOrder {
  readonly email: string | null;
  readonly phone: string | null;
  readonly customer: {
    readonly defaultEmailAddress: { readonly emailAddress: string } | null;
    readonly defaultPhoneNumber: { readonly phoneNumber: string } | null;
  } | null;
  readonly shippingAddress: { readonly phone: string | null } | null;
  readonly billingAddress: { readonly phone: string | null } | null;
  readonly fulfillments: readonly InvoiceFulfillment[];
}

export interface InvoiceContactData {
  readonly order: InvoiceContactOrder | null;
}
