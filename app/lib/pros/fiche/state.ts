import type { FicheCustomerData, FicheLocationData } from "./documents";

/**
 * Fiche d'un compte pro : ce que le site lui demande de compléter. Logique pure, testée.
 * Même règle que l'encart de l'Espace pro (thème, snippet `bp-pro-fiche-manque.liquid`) : si les deux divergeaient,
 * l'encart enverrait le client sur une page qui lui dit que tout est complet.
 * - le nom : prénom et nom de la personne ;
 * - le téléphone de la personne (celui du restaurant ne se voit pas sur le site) ;
 * - l'adresse de livraison de l'établissement : rue, NPA et localité.
 */

export type FichePart = "name" | "phone" | "address";

const PARTS: readonly FichePart[] = ["name", "phone", "address"];

export interface FicheAddress {
  readonly address1: string | null;
  readonly zip: string | null;
  readonly city: string | null;
}

export interface FicheLocation {
  readonly id: string;
  readonly phone: string | null;
  readonly shippingAddress: FicheAddress | null;
  readonly hasBillingAddress: boolean;
}

export interface FicheState {
  readonly customerId: string;
  readonly companyName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly phone: string | null;
  readonly location: FicheLocation;
}

function blank(value: string | null): boolean {
  return value === null || value.trim() === "";
}

function present(value: string | null): string | null {
  return blank(value) ? null : value;
}

function hasDeliveryAddress(address: FicheAddress | null): boolean {
  return address !== null && !blank(address.address1) && !blank(address.zip) && !blank(address.city);
}

function isMissing(part: FichePart, state: FicheState): boolean {
  if (part === "name") return blank(state.firstName) || blank(state.lastName);
  if (part === "phone") return blank(state.phone);
  return !hasDeliveryAddress(state.location.shippingAddress);
}

export function missingParts(state: FicheState): readonly FichePart[] {
  return PARTS.filter((part) => isMissing(part, state));
}

const PART_WORDS: Readonly<Record<FichePart, string>> = {
  name: "votre nom",
  phone: "votre numéro de téléphone",
  address: "l’adresse de livraison",
};

/** « votre nom, votre numéro de téléphone et l’adresse de livraison ». */
export function describeMissing(parts: readonly FichePart[]): string {
  const words = parts.map((part) => PART_WORDS[part]);
  const last = words.pop();
  if (last === undefined) return "";
  return words.length === 0 ? last : `${words.join(", ")} et ${last}`;
}

/** Le nombre au bout d'un identifiant Shopify (« gid://shopify/CompanyLocation/10 » → « 10 »), celui que voit le thème. */
export function numericId(gid: string): string {
  return gid.slice(gid.lastIndexOf("/") + 1);
}

function toLocation(data: FicheLocationData): FicheLocation {
  return {
    id: data.id,
    phone: present(data.phone),
    shippingAddress: data.shippingAddress,
    hasBillingAddress: data.billingAddress !== null,
  };
}

/**
 * La fiche du client, pour l'établissement choisi sur le site (`lieu`) s'il est bien le sien, sinon le premier.
 * `null` : client introuvable, ou rattaché à aucune entreprise.
 */
export function ficheStateFrom(data: FicheCustomerData, lieu: string | null): FicheState | null {
  const customer = data.customer;
  if (customer === null) return null;
  const assignments = customer.companyContactProfiles.flatMap((profile) =>
    profile.roleAssignments.nodes.map((node) => ({ companyName: profile.company.name, location: node.companyLocation })),
  );
  const chosen = assignments.find((assignment) => numericId(assignment.location.id) === lieu) ?? assignments[0];
  if (chosen === undefined) return null;
  return {
    customerId: customer.id,
    companyName: chosen.companyName,
    firstName: present(customer.firstName),
    lastName: present(customer.lastName),
    phone: present(customer.defaultPhoneNumber?.phoneNumber ?? null),
    location: toLocation(chosen.location),
  };
}
