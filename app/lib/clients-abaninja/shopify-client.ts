import { PRO_CUSTOMER_TAGS } from "../agenda/mapping";
import { normalizePhoneE164 } from "../factures/phone";
import { parseLink, parseUuidList, type AbaNinjaLink } from "./link";
import { normalizeEmail } from "./normalize";

/** Un client de la boutique, ramené à ce qui sert à le comparer aux fiches AbaNinja. */

export interface ShopifyClient {
  readonly customerId: string;
  readonly displayName: string;
  /** Noms sous lesquels on peut le reconnaître : le sien (dans les deux sens), son entreprise. */
  readonly names: readonly string[];
  readonly email: string | null;
  readonly phone: string | null;
  /** « 1095 Lutry », pour reconnaître le client à l'écran. */
  readonly town: string | null;
  readonly hasAddress: boolean;
  readonly isPro: boolean;
  /** Entreprises Shopify (B2B) dont il est contact. */
  readonly companyIds: readonly string[];
  readonly link: AbaNinjaLink | null;
  readonly companyLink: AbaNinjaLink | null;
  /** Fiches AbaNinja pour lesquelles on a répondu « ce n'est pas lui ». */
  readonly refused: readonly string[];
}

export interface ShopifySide {
  readonly shopId: string;
  readonly clients: readonly ShopifyClient[];
  /** Fiches AbaNinja mises de côté (fournisseurs, fiches qui ne sont pas des clients). */
  readonly ignored: readonly string[];
  readonly truncated: boolean;
}

interface MetafieldValue {
  readonly value: string;
}

/** Un client tel que le lit `shopify-read.server.ts`. */
export interface CustomerMatchNode {
  readonly id: string;
  readonly displayName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly tags: readonly string[];
  readonly defaultEmailAddress: { readonly emailAddress: string | null } | null;
  readonly defaultPhoneNumber: { readonly phoneNumber: string } | null;
  readonly defaultAddress: { readonly company: string | null; readonly zip: string | null; readonly city: string | null } | null;
  readonly lien: MetafieldValue | null;
  readonly refus: MetafieldValue | null;
  readonly companyContactProfiles: readonly {
    readonly company: { readonly id: string; readonly name: string; readonly lien: MetafieldValue | null };
  }[];
}

function filled(values: readonly (string | null | undefined)[]): string[] {
  const kept = values.map((value) => value?.trim() ?? "").filter((value) => value !== "");
  return [...new Set(kept)];
}

export function toShopifyClient(node: CustomerMatchNode): ShopifyClient {
  const companies = node.companyContactProfiles.map((profile) => profile.company);
  const fullName = filled([node.firstName, node.lastName]).join(" ");
  const reversed = filled([node.lastName, node.firstName]).join(" ");
  const address = node.defaultAddress;
  const town = filled([address?.zip, address?.city]).join(" ");
  const tags = node.tags.map((tag) => tag.toLowerCase());
  return {
    customerId: node.id,
    displayName: node.displayName,
    names: filled([node.displayName, fullName, reversed, address?.company, ...companies.map((company) => company.name)]),
    email: normalizeEmail(node.defaultEmailAddress?.emailAddress),
    phone: normalizePhoneE164(node.defaultPhoneNumber?.phoneNumber),
    town: town === "" ? null : town,
    hasAddress: address !== null,
    isPro: companies.length > 0 || tags.some((tag) => PRO_CUSTOMER_TAGS.includes(tag)),
    companyIds: companies.map((company) => company.id),
    link: parseLink(node.lien?.value),
    companyLink: companies.map((company) => parseLink(company.lien?.value)).find((link) => link !== null) ?? null,
    refused: parseUuidList(node.refus?.value),
  };
}
