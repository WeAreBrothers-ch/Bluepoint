import { formatIbanForDisplay } from "./identifiers";
import { DEFAULT_LEGAL_NAME, type SettingsFieldErrors } from "./schema";
import type { StoredSettings } from "./seller";

/** Valeurs affichées dans le formulaire des réglages (toutes en texte). */

export interface SettingsFormValues {
  readonly legalName: string;
  readonly street: string;
  readonly buildingNumber: string;
  readonly postalCode: string;
  readonly city: string;
  readonly country: string;
  readonly vatNumber: string;
  readonly iban: string;
  readonly qrIban: string;
  readonly paymentTermDays: string;
  readonly email: string;
  readonly phone: string;
  readonly autoInvoiceOnDelivery: boolean;
  readonly notifyCustomerOnDelivery: boolean;
}

export const EMPTY_SETTINGS_FORM: SettingsFormValues = {
  legalName: DEFAULT_LEGAL_NAME,
  street: "",
  buildingNumber: "",
  postalCode: "",
  city: "",
  country: "CH",
  vatNumber: "",
  iban: "",
  qrIban: "",
  paymentTermDays: "30",
  email: "",
  phone: "",
  autoInvoiceOnDelivery: false,
  notifyCustomerOnDelivery: false,
};

export function toFormValues(stored: StoredSettings | null): SettingsFormValues {
  if (stored === null) return EMPTY_SETTINGS_FORM;
  return {
    ...stored,
    iban: formatIbanForDisplay(stored.iban),
    qrIban: stored.qrIban === null ? "" : formatIbanForDisplay(stored.qrIban),
    paymentTermDays: String(stored.paymentTermDays),
  };
}

export type SettingsActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: SettingsFieldErrors; readonly message: string };
