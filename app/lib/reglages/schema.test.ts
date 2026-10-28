import { describe, expect, it } from "vitest";
import { normalizeVatNumber } from "./identifiers";
import { formDataToRecord, parseSettings } from "./schema";
import { completeSettings, toInvoiceSeller, type StoredSettings } from "./seller";

// Valeurs d'exemple officielles (IBAN et numéro TVA fictifs).
const valid: Record<string, string> = {
  legalName: "Blue Point Distribution Sàrl",
  street: "Rue du Châtelard",
  buildingNumber: "44",
  postalCode: "1095",
  city: "Lutry",
  country: "ch",
  vatNumber: "che123456788 mwst",
  iban: "CH93 0076 2011 6238 5295 7",
  qrIban: "",
  paymentTermDays: "30",
  email: "info@bluepointdistribution.com",
  phone: "+41 79 606 33 22",
  autoInvoiceOnDelivery: "on",
};

describe("parseSettings", () => {
  it("accepte et normalise des réglages complets", () => {
    const result = parseSettings(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values).toMatchObject({
      country: "CH",
      vatNumber: "CHE-123.456.788 TVA",
      iban: "CH9300762011623852957",
      qrIban: null,
      paymentTermDays: 30,
      autoInvoiceOnDelivery: true,
      notifyCustomerOnDelivery: false,
    });
  });

  it("donne une erreur en français par champ fautif", () => {
    const result = parseSettings({ ...valid, legalName: " ", iban: "CH00 1234", postalCode: "10950", email: "info@" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.legalName).toBe("Champ obligatoire.");
    expect(result.errors.iban).toMatch(/IBAN suisse/);
    expect(result.errors.postalCode).toMatch(/4 chiffres/);
    expect(result.errors.email).toBe("Adresse e-mail invalide.");
  });

  it("range un QR-IBAN au bon endroit", () => {
    const qr = "CH44 3199 9123 0008 8901 2";
    expect(parseSettings({ ...valid, iban: qr }).ok).toBe(false);
    const result = parseSettings({ ...valid, qrIban: qr });
    expect(result.ok && result.values.qrIban).toBe("CH4431999123000889012");
    const wrong = parseSettings({ ...valid, qrIban: valid.iban });
    expect(!wrong.ok && wrong.errors.qrIban).toMatch(/pas un QR-IBAN/);
  });

  it("refuse un délai de paiement vide ou démesuré", () => {
    expect(parseSettings({ ...valid, paymentTermDays: "" }).ok).toBe(false);
    expect(parseSettings({ ...valid, paymentTermDays: "365" }).ok).toBe(false);
  });

  it("lit un FormData", () => {
    const form = new FormData();
    form.set("legalName", "X");
    form.set("inconnu", "Y");
    expect(formDataToRecord(form)).toEqual({ legalName: "X" });
  });
});

describe("numéro TVA", () => {
  it("vérifie le chiffre de contrôle", () => {
    expect(normalizeVatNumber("CHE-123.456.788")).toBe("CHE-123.456.788 TVA");
    expect(normalizeVatNumber("CHE-123.456.789")).toBeNull();
  });
});

describe("completeSettings et toInvoiceSeller", () => {
  const stored: StoredSettings = {
    legalName: "Blue Point Distribution Sàrl",
    street: "Rue du Châtelard",
    buildingNumber: "44",
    postalCode: "1095",
    city: "Lutry",
    country: "CH",
    vatNumber: "CHE-123.456.788 TVA",
    iban: "CH9300762011623852957",
    qrIban: null,
    paymentTermDays: 30,
    email: "info@bluepointdistribution.com",
    phone: "+41 79 606 33 22",
    autoInvoiceOnDelivery: false,
    notifyCustomerOnDelivery: false,
  };

  it("refuse des réglages absents ou incomplets", () => {
    expect(completeSettings(null)).toBeNull();
    expect(completeSettings({ ...stored, vatNumber: "" })).toBeNull();
  });

  it("produit le vendeur de la facture, sans QR-IBAN s'il manque", () => {
    const settings = completeSettings(stored);
    expect(settings).not.toBeNull();
    if (settings === null) return;
    const seller = toInvoiceSeller(settings);
    expect(seller).toMatchObject({ name: "Blue Point Distribution Sàrl", iban: "CH9300762011623852957" });
    expect("qrIban" in seller).toBe(false);
  });
});
