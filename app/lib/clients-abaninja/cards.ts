import { normalizePhoneE164 } from "../factures/phone";
import type { z } from "zod";
import { abaNinjaRecordSchema, type AbaNinjaContact } from "./abaninja-schema";
import type { CardKind } from "./link";
import { normalizeEmail, normalizeName } from "./normalize";

/** Une fiche AbaNinja ramenée à ce qui sert à la retrouver et à la créer dans la boutique. */

export interface CardAddress {
  readonly street: string;
  readonly extra: string | null;
  readonly zip: string;
  readonly city: string;
  readonly countryCode: string;
}

export interface AbaNinjaCard {
  readonly uuid: string;
  readonly kind: CardKind;
  readonly number: string | null;
  readonly name: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  /** Normalisés, sans doublon : le principal d'abord, puis les autres, puis ceux des personnes de contact. */
  readonly emails: readonly string[];
  /** Premier numéro exploitable, au format +41… */
  readonly phone: string | null;
  readonly address: CardAddress | null;
  readonly vatNumber: string | null;
  readonly language: string | null;
  readonly tags: readonly string[];
}

const PRIVATE_CUSTOMERS_NUMBER = "1062";
const PRIVATE_CUSTOMERS_NAME = "clients prives";
const PHONE_TYPES: ReadonlySet<string> = new Set(["phone", "mobile"]);

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function isPrimary(contact: AbaNinjaContact): boolean {
  return contact.is_primary === true || contact.primary === true;
}

/** Valeurs d'un type de contact, le principal d'abord. */
function contactValues(contacts: readonly AbaNinjaContact[], types: ReadonlySet<string>): string[] {
  const wanted = contacts.filter((contact) => types.has(contact.type?.toLowerCase() ?? ""));
  const ordered = [...wanted.filter(isPrimary), ...wanted.filter((contact) => !isPrimary(contact))];
  return ordered.map((contact) => contact.value ?? "");
}

type ParsedRecord = z.output<typeof abaNinjaRecordSchema>;

function allContacts(record: ParsedRecord): AbaNinjaContact[][] {
  return [record.contacts ?? [], ...(record.contact_persons ?? []).map((person) => person.contacts ?? [])];
}

function emailsOf(record: ParsedRecord): string[] {
  const types: ReadonlySet<string> = new Set(["email"]);
  const emails = allContacts(record).flatMap((contacts) => contactValues(contacts, types).map(normalizeEmail));
  return [...new Set(emails.filter((email): email is string => email !== null))];
}

function phoneOf(record: ParsedRecord): string | null {
  for (const contacts of allContacts(record)) {
    for (const value of contactValues(contacts, PHONE_TYPES)) {
      const phone = normalizePhoneE164(value);
      if (phone !== null) return phone;
    }
  }
  return null;
}

const COUNTRY_CODE = /^[A-Z]{2}$/;

/** Code pays à deux lettres (Shopify refuse le reste) ; absent → Suisse ; illisible → null. */
function countryOf(raw: string | null | undefined): string | null {
  const code = clean(raw)?.toUpperCase() ?? "CH";
  return COUNTRY_CODE.test(code) ? code : null;
}

function addressOf(record: ParsedRecord): CardAddress | null {
  for (const address of record.addresses ?? []) {
    const street = clean([address.address, address.street_number].map((part) => part?.trim() ?? "").join(" "));
    const zip = clean(address.zip_code);
    const city = clean(address.city);
    const countryCode = countryOf(address.country_code);
    if (street !== null && zip !== null && city !== null && countryCode !== null) {
      const extra = clean(address.extension) ?? clean(address.additional_field);
      return { street, extra, zip, city, countryCode };
    }
  }
  return null;
}

function namesOf(record: ParsedRecord, kind: CardKind): { name: string | null; firstName: string | null; lastName: string | null } {
  if (kind === "person") {
    const firstName = clean(record.first_name);
    const lastName = clean(record.last_name);
    return { name: clean([firstName, lastName].filter(Boolean).join(" ")), firstName, lastName };
  }
  const contact = (record.contact_persons ?? []).find((person) => clean(person.first_name) !== null || clean(person.last_name) !== null);
  return { name: clean(record.name), firstName: clean(contact?.first_name), lastName: clean(contact?.last_name) };
}

/** Une étiquette arrive en texte ou en objet { name } selon les comptes. */
function tagName(tag: unknown): string | null {
  if (typeof tag === "string") return clean(tag);
  if (typeof tag === "object" && tag !== null && "name" in tag && typeof tag.name === "string") return clean(tag.name);
  return null;
}

/** null quand la fiche est illisible ou n'a pas de nom. */
export function toCard(raw: unknown, kind: CardKind): AbaNinjaCard | null {
  const parsed = abaNinjaRecordSchema.safeParse(raw);
  if (!parsed.success) return null;
  const record = parsed.data;
  const { name, firstName, lastName } = namesOf(record, kind);
  if (name === null) return null;
  const language = clean(record.language)?.toLowerCase() ?? null;
  return {
    uuid: record.uuid.toLowerCase(),
    kind,
    number: clean(record.customer_number),
    name,
    firstName,
    lastName,
    emails: emailsOf(record),
    phone: phoneOf(record),
    address: addressOf(record),
    vatNumber: clean(record.vat_number),
    language: language !== null && /^[a-z]{2}$/.test(language) ? language : null,
    tags: (record.tags ?? []).map(tagName).filter((tag): tag is string => tag !== null),
  };
}

/** La fiche « Clients privés » (n° 1062) regroupe tous les particuliers : elle n'est pas un client à reprendre. */
export function isPrivateCustomersCard(card: AbaNinjaCard): boolean {
  return card.number === PRIVATE_CUSTOMERS_NUMBER || normalizeName(card.name) === PRIVATE_CUSTOMERS_NAME;
}
