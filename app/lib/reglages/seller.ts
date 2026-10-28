import type { InvoiceSellerRaw } from "@bluepoint/facture-qr";
import { parseSettings, type ShopSettingsValues } from "./schema";

/** Passage des réglages enregistrés au vendeur attendu par le moteur de facture. */

/** Réglages tels que stockés (ligne Prisma `ShopSettings`, champs utiles). */
export interface StoredSettings {
  readonly legalName: string;
  readonly street: string;
  readonly buildingNumber: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly vatNumber: string;
  readonly iban: string;
  readonly qrIban: string | null;
  readonly paymentTermDays: number;
  readonly email: string;
  readonly phone: string;
  readonly autoInvoiceOnDelivery: boolean;
  readonly notifyCustomerOnDelivery: boolean;
}

/** Réglages complets et valides, ou `null` : aucune facture ne doit alors être créée. */
export function completeSettings(stored: StoredSettings | null): ShopSettingsValues | null {
  if (stored === null) return null;
  const parsed = parseSettings({
    ...stored,
    qrIban: stored.qrIban ?? "",
    paymentTermDays: String(stored.paymentTermDays),
    autoInvoiceOnDelivery: stored.autoInvoiceOnDelivery ? "on" : "",
    notifyCustomerOnDelivery: stored.notifyCustomerOnDelivery ? "on" : "",
  });
  return parsed.ok ? parsed.values : null;
}

export function toInvoiceSeller(settings: ShopSettingsValues): InvoiceSellerRaw {
  return {
    name: settings.legalName,
    street: settings.street,
    buildingNumber: settings.buildingNumber,
    postalCode: settings.postalCode,
    city: settings.city,
    country: settings.country,
    vatNumber: settings.vatNumber,
    iban: settings.iban,
    ...(settings.qrIban === null ? {} : { qrIban: settings.qrIban }),
    email: settings.email,
    phone: settings.phone,
  };
}
