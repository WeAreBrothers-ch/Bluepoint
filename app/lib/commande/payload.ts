import { LIVRAISON_KEYS, LIVRAISON_NAMESPACE, type DeliveryMode, type IsoDate, type LivraisonKey } from "../metafields/definitions";
import type { B2bPurchaser, CustomerGid, PhoneOrderInput, PhoneOrderLine, ShippingAddress } from "./types";

/**
 * Construction des variables envoyées à Shopify (`DraftOrderInput`, `MetafieldsSetInput`).
 * Fonctions pures : testées sans Shopify.
 */

/** Étiquette posée sur toutes les commandes prises par téléphone. */
export const PHONE_ORDER_TAG = "telephone";

export interface PaymentTermsInput {
  readonly paymentTermsTemplateId: string;
  /** Seulement pour « net N jours » : l'échéance se compte depuis cette date. */
  readonly paymentSchedules?: readonly { readonly issuedAt: string }[];
}

type PurchasingEntityInput =
  | { readonly customerId: CustomerGid }
  | { readonly purchasingCompany: B2bPurchaser };

export interface DraftOrderInput {
  readonly purchasingEntity: PurchasingEntityInput;
  /** Applique les remises automatiques de la boutique (ex. « Prix pro -15 % »), comme sur le site. */
  readonly acceptAutomaticDiscounts: boolean;
  readonly lineItems: readonly { readonly variantId: string; readonly quantity: number }[];
  readonly shippingAddress?: ShippingAddress;
  readonly metafields?: readonly MetafieldValueInput[];
  readonly note?: string;
  readonly tags?: readonly string[];
  readonly paymentTerms?: PaymentTermsInput;
}

export interface MetafieldValueInput {
  readonly namespace: string;
  readonly key: LivraisonKey;
  readonly type: "date" | "single_line_text_field";
  readonly value: string;
}

export function dateMetafield(key: typeof LIVRAISON_KEYS.dateSouhaitee | typeof LIVRAISON_KEYS.dateLimite, value: IsoDate): MetafieldValueInput {
  return { namespace: LIVRAISON_NAMESPACE, key, type: "date", value };
}

export function modeMetafield(mode: DeliveryMode): MetafieldValueInput {
  return { namespace: LIVRAISON_NAMESPACE, key: LIVRAISON_KEYS.mode, type: "single_line_text_field", value: mode };
}

/** Les trois métachamps « livraison » de la commande. */
export function livraisonMetafields(order: Pick<PhoneOrderInput, "requestedDate" | "deadline" | "mode">): MetafieldValueInput[] {
  return [
    dateMetafield(LIVRAISON_KEYS.dateSouhaitee, order.requestedDate),
    dateMetafield(LIVRAISON_KEYS.dateLimite, order.deadline),
    modeMetafield(order.mode),
  ];
}

function purchasingEntity(customerId: CustomerGid, b2b: B2bPurchaser | null): PurchasingEntityInput {
  return b2b === null ? { customerId } : { purchasingCompany: b2b };
}

function lineItems(lines: readonly PhoneOrderLine[]) {
  return lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity }));
}

/** Adresse sans champs vides : Shopify refuse certaines chaînes vides (pays, canton). */
export function cleanAddress(address: ShippingAddress | null): ShippingAddress | null {
  if (address === null) return null;
  const clean = (value: string | null): string | null => (value?.trim() ? value.trim() : null);
  const cleaned: ShippingAddress = {
    firstName: clean(address.firstName),
    lastName: clean(address.lastName),
    company: clean(address.company),
    address1: clean(address.address1),
    address2: clean(address.address2),
    zip: clean(address.zip),
    city: clean(address.city),
    provinceCode: clean(address.provinceCode),
    countryCode: clean(address.countryCode),
    phone: clean(address.phone),
  };
  return cleaned.address1 === null && cleaned.city === null ? null : cleaned;
}

export function buildDraftOrderInput(
  order: PhoneOrderInput,
  address: ShippingAddress | null,
  paymentTerms: PaymentTermsInput | null,
): DraftOrderInput {
  const shipping = cleanAddress(address);
  const note = order.note.trim();
  return {
    purchasingEntity: purchasingEntity(order.customerId, order.b2b),
    acceptAutomaticDiscounts: true,
    lineItems: lineItems(order.lines),
    ...(shipping === null ? {} : { shippingAddress: shipping }),
    metafields: livraisonMetafields(order),
    ...(note === "" ? {} : { note }),
    tags: [PHONE_ORDER_TAG],
    ...(paymentTerms === null ? {} : { paymentTerms }),
  };
}

/**
 * Entrée de `draftOrderCalculate` : les prix que Shopify appliquera à ce client
 * (catalogue B2B de l'entreprise, remise pro automatique…).
 */
export function buildCalculationInput(
  customerId: CustomerGid,
  b2b: B2bPurchaser | null,
  lines: readonly PhoneOrderLine[],
): DraftOrderInput {
  return { purchasingEntity: purchasingEntity(customerId, b2b), acceptAutomaticDiscounts: true, lineItems: lineItems(lines) };
}

export interface OrderMetafieldsSetInput extends MetafieldValueInput {
  readonly ownerId: string;
}

export function forOwner(ownerId: string, metafields: readonly MetafieldValueInput[]): OrderMetafieldsSetInput[] {
  return metafields.map((metafield) => ({ ...metafield, ownerId }));
}

export interface PaymentTermsTemplateRef {
  readonly id: string;
  readonly name: string;
  readonly paymentTermsType: string;
  readonly dueInDays: number | null;
}

export interface ChosenTemplate {
  readonly template: PaymentTermsTemplateRef;
  /** Faux si le délai exact n'existe pas chez Shopify (modèle le plus proche choisi). */
  readonly exact: boolean;
}

/**
 * Modèle « net N jours » : le délai exact, sinon le plus court qui le dépasse,
 * sinon le plus long disponible. `null` si Shopify n'en propose aucun.
 */
export function pickNetTemplate(templates: readonly PaymentTermsTemplateRef[], days: number): ChosenTemplate | null {
  const net = templates
    .filter((template): template is PaymentTermsTemplateRef & { dueInDays: number } =>
      template.paymentTermsType === "NET" && template.dueInDays !== null)
    .sort((a, b) => a.dueInDays - b.dueInDays);
  const exact = net.find((template) => template.dueInDays === days);
  if (exact !== undefined) return { template: exact, exact: true };
  const closest = net.find((template) => template.dueInDays > days) ?? net.at(-1);
  return closest === undefined ? null : { template: closest, exact: false };
}

/** Modèle « payable à l'expédition » : la commande reste à payer jusqu'à la livraison. */
export function pickFulfillmentTemplate(templates: readonly PaymentTermsTemplateRef[]): ChosenTemplate | null {
  const template = templates.find((candidate) => candidate.paymentTermsType === "FULFILLMENT");
  return template === undefined ? null : { template, exact: true };
}

/**
 * Conditions de paiement. Net N jours : l'échéance court à partir de la création de la commande (`issuedAt`).
 * À l'expédition : pas d'échéancier, Shopify fixe l'échéance au moment de la livraison.
 */
export function buildPaymentTerms(templateId: string, issuedAt: Date | null): PaymentTermsInput {
  return issuedAt === null
    ? { paymentTermsTemplateId: templateId }
    : { paymentTermsTemplateId: templateId, paymentSchedules: [{ issuedAt: issuedAt.toISOString() }] };
}
