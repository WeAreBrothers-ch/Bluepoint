import { swissIsoDate } from "../agenda/dates";
import { PRO_CUSTOMER_TAGS } from "../agenda/mapping";
import { parseGid } from "../shopify/ids";
import type { CompanyContactNode, CustomerAddressNode, CustomerNode, LastOrderNode } from "./queries";
import type { B2bOption, CustomerOption, LastOrder, PhoneOrderLine, ShippingAddress } from "./types";

/** Recherche de clients : texte saisi → filtre Shopify, et réponse GraphQL → options affichées. */

export const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 80;

/**
 * Texte libre → filtre `customers(query:)`. Les caractères de syntaxe de recherche
 * (guillemets, deux-points, parenthèses…) sont retirés : la saisie reste une recherche
 * plein texte (nom, entreprise, téléphone, e-mail). `null` si trop court.
 */
export function customerSearchQuery(raw: string): string | null {
  const term = raw
    .replace(/["'\\:()[\]{}<>!*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
  return term.length < MIN_SEARCH_LENGTH ? null : term;
}

export function toShippingAddress(node: CustomerAddressNode | null): ShippingAddress | null {
  if (node === null) return null;
  return {
    firstName: node.firstName,
    lastName: node.lastName,
    company: node.company,
    address1: node.address1,
    address2: node.address2,
    zip: node.zip,
    city: node.city,
    provinceCode: node.provinceCode,
    countryCode: node.countryCodeV2,
    phone: node.phone,
  };
}

const REGION_NAMES = new Intl.DisplayNames(["fr-CH"], { type: "region" });

/**
 * Adresse en français, une ligne par élément (Shopify renvoie « Switzerland » dans `formatted`).
 * Le pays n'est écrit que hors de Suisse.
 */
export function addressLines(address: ShippingAddress | null): string[] {
  if (address === null) return [];
  const town = [address.zip, address.city].filter((part) => part !== null && part.trim() !== "").join(" ");
  const code = address.countryCode?.trim().toUpperCase() ?? "";
  const country = code === "" || code === "CH" ? null : (REGION_NAMES.of(code) ?? code);
  return [address.company, address.address1, address.address2, town, country]
    .map((line) => line?.trim() ?? "")
    .filter((line) => line !== "");
}

function toB2bOptions(profile: CompanyContactNode): B2bOption[] {
  const companyId = parseGid(profile.company.id, "Company");
  const companyContactId = parseGid(profile.id, "CompanyContact");
  if (companyId === null || companyContactId === null) return [];
  return profile.roleAssignments.nodes.flatMap(({ companyLocation }) => {
    const companyLocationId = parseGid(companyLocation.id, "CompanyLocation");
    return companyLocationId === null
      ? []
      : [{ companyId, companyContactId, companyLocationId, companyName: profile.company.name, locationName: companyLocation.name }];
  });
}

function uniqueLocations(options: readonly B2bOption[]): B2bOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.companyLocationId)) return false;
    seen.add(option.companyLocationId);
    return true;
  });
}

/** Lignes encore commandées dont la variante existe toujours ; `null` s'il n'en reste aucune. */
export function toLastOrder(node: LastOrderNode | null): LastOrder | null {
  if (node === null) return null;
  const lines = node.lineItems.nodes.flatMap((line): PhoneOrderLine[] => {
    const variantId = line.variant === null ? null : parseGid(line.variant.id, "ProductVariant");
    return variantId === null || line.currentQuantity <= 0 ? [] : [{ variantId, quantity: line.currentQuantity }];
  });
  if (lines.length === 0) return null;
  const created = new Date(node.createdAt);
  return { name: node.name, date: Number.isNaN(created.getTime()) ? null : swissIsoDate(created), lines };
}

/** `null` si l'identifiant du client est illisible. */
export function toCustomerOption(node: CustomerNode): CustomerOption | null {
  const id = parseGid(node.id, "Customer");
  if (id === null) return null;
  const profiles = node.companyContactProfiles ?? [];
  const phone = node.defaultPhoneNumber?.phoneNumber ?? node.defaultAddress?.phone ?? null;
  const b2b = uniqueLocations(profiles.flatMap(toB2bOptions));
  const tags = node.tags.map((tag) => tag.trim().toLowerCase());
  return {
    id,
    displayName: node.displayName.trim() || "Client sans nom",
    isPro: b2b.length > 0 || tags.some((tag) => PRO_CUSTOMER_TAGS.includes(tag)),
    lastOrder: toLastOrder(node.lastOrder),
    email: node.defaultEmailAddress?.emailAddress ?? null,
    phone: phone?.trim() ? phone.trim() : null,
    address: toShippingAddress(node.defaultAddress),
    addressLines: addressLines(toShippingAddress(node.defaultAddress)),
    b2b,
  };
}

export function toCustomerOptions(nodes: readonly CustomerNode[]): CustomerOption[] {
  return nodes.flatMap((node) => {
    const option = toCustomerOption(node);
    return option === null ? [] : [option];
  });
}
