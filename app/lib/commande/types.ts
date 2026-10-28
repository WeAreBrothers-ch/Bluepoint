import type { DeliveryMode, IsoDate } from "../metafields/definitions";
import type { ShopifyGid } from "../shopify/ids";

/**
 * Commande prise par téléphone : saisie dans l'admin, elle devient une commande
 * provisoire Shopify (draft order) avec les métachamps `livraison`, puis une commande.
 */

export type CustomerGid = ShopifyGid<"Customer">;
export type VariantGid = ShopifyGid<"ProductVariant">;
export type DraftOrderGid = ShopifyGid<"DraftOrder">;
export type CompanyGid = ShopifyGid<"Company">;
export type CompanyContactGid = ShopifyGid<"CompanyContact">;
export type CompanyLocationGid = ShopifyGid<"CompanyLocation">;

/** « Bon de commande » : paiement plus tard (net N jours). « Payé » : encaissé maintenant. */
export const PAYMENT_CHOICES = ["bon_de_commande", "paye"] as const;
export type PaymentChoice = (typeof PAYMENT_CHOICES)[number];

/** Nombre de bouteilles au plus par ligne (garde-fou contre une faute de frappe). */
export const MAX_LINE_QUANTITY = 9999;

export interface PhoneOrderLine {
  readonly variantId: VariantGid;
  /** Nombre de bouteilles (entier strictement positif). */
  readonly quantity: number;
}

/** Achat au nom d'une entreprise (B2B Shopify) : les trois identifiants sont requis. */
export interface B2bPurchaser {
  readonly companyId: CompanyGid;
  readonly companyContactId: CompanyContactGid;
  readonly companyLocationId: CompanyLocationGid;
}

export interface PhoneOrderInput {
  /** Clé générée par le navigateur : un double clic ne crée jamais deux commandes. */
  readonly idempotencyKey: string;
  readonly customerId: CustomerGid;
  readonly b2b: B2bPurchaser | null;
  readonly lines: readonly PhoneOrderLine[];
  readonly requestedDate: IsoDate;
  readonly deadline: IsoDate;
  readonly mode: DeliveryMode;
  /** Remarque interne visible dans l'admin (accès, horaires…). */
  readonly note: string;
  readonly payment: PaymentChoice;
}

/** Adresse au format attendu par Shopify (`MailingAddressInput`). */
export interface ShippingAddress {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly company: string | null;
  readonly address1: string | null;
  readonly address2: string | null;
  readonly zip: string | null;
  readonly city: string | null;
  readonly provinceCode: string | null;
  readonly countryCode: string | null;
  readonly phone: string | null;
}

/** Un site d'entreprise B2B auquel le client est rattaché. */
export interface B2bOption extends B2bPurchaser {
  readonly companyName: string;
  readonly locationName: string;
}

export interface CustomerOption {
  readonly id: CustomerGid;
  readonly displayName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: ShippingAddress | null;
  /** Adresse prête à afficher, une ligne par élément. */
  readonly addressLines: readonly string[];
  readonly b2b: readonly B2bOption[];
}

export interface ProductOption {
  readonly variantId: VariantGid;
  readonly productTitle: string;
  /** `null` pour la variante unique par défaut. */
  readonly variantTitle: string | null;
  readonly sku: string | null;
  readonly priceCents: number;
  /** Stock disponible ; `null` si le stock n'est pas suivi. */
  readonly available: number | null;
  readonly imageUrl: string | null;
  readonly imageAlt: string;
}
