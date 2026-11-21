import type { ProAccountInput } from "../pros/company-input";
import { normalizeVatNumber } from "../reglages/identifiers";
import type { AbaNinjaCard } from "./cards";
import { ABANINJA_NAMESPACE, LINK_KEY, serializeLink, type AbaNinjaLink } from "./link";

/** Une fiche AbaNinja traduite en entrées Shopify. Logique pure : rien n'est envoyé ici. */

const SHOPIFY_LOCALES: ReadonlySet<string> = new Set(["fr", "de", "it", "en"]);

export function cardLink(card: AbaNinjaCard): AbaNinjaLink {
  return { uuid: card.uuid, kind: card.kind, number: card.number };
}

export function linkMetafield(card: AbaNinjaCard) {
  return { namespace: ABANINJA_NAMESPACE, key: LINK_KEY, type: "json", value: serializeLink(cardLink(card)) };
}

export function toProAccountInput(card: AbaNinjaCard, email: string, phone: string | null): ProAccountInput {
  return {
    companyName: card.name,
    firstName: card.firstName,
    lastName: card.lastName,
    email,
    phone,
    street: card.address?.street ?? null,
    postalCode: card.address?.zip ?? null,
    city: card.address?.city ?? null,
    country: card.address?.countryCode ?? "CH",
    vatNumber: card.vatNumber === null ? null : normalizeVatNumber(card.vatNumber),
  };
}

export interface PersonCustomerInput {
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly phone?: string;
  readonly locale?: string;
  readonly note: string;
  readonly metafields: readonly ReturnType<typeof linkMetafield>[];
}

/** Client particulier : aucun consentement marketing n'est donné (pas d'abonnement à la lettre). */
export function toPersonCustomerInput(card: AbaNinjaCard, email: string, phone: string | null): PersonCustomerInput {
  return {
    email,
    ...(card.firstName === null ? {} : { firstName: card.firstName }),
    ...(card.lastName === null ? {} : { lastName: card.lastName }),
    ...(phone === null ? {} : { phone }),
    ...(card.language !== null && SHOPIFY_LOCALES.has(card.language) ? { locale: card.language } : {}),
    note: card.number === null ? "Repris d’AbaNinja." : `Repris d’AbaNinja (fiche n° ${card.number}).`,
    metafields: [linkMetafield(card)],
  };
}

export interface MailingAddress {
  readonly address1: string;
  readonly address2?: string;
  readonly zip: string;
  readonly city: string;
  readonly countryCode: string;
  readonly company?: string;
  readonly firstName?: string;
  readonly lastName?: string;
}

export function toMailingAddress(card: AbaNinjaCard): MailingAddress | null {
  const address = card.address;
  if (address === null) return null;
  return {
    address1: address.street,
    ...(address.extra === null ? {} : { address2: address.extra }),
    zip: address.zip,
    city: address.city,
    countryCode: address.countryCode,
    ...(card.kind === "company" ? { company: card.name } : {}),
    ...(card.firstName === null ? {} : { firstName: card.firstName }),
    ...(card.lastName === null ? {} : { lastName: card.lastName }),
  };
}
