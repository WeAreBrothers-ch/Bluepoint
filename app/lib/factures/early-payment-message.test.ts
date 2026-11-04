import { describe, expect, it } from "vitest";
import { d } from "../agenda/fixtures";
import { earlyPaymentOffer } from "../escompte/early-payment";
import { emailText, whatsappMessage, type InvoiceMessageData } from "./messages";

const offer = earlyPaymentOffer({ issueDate: "2026-11-04", dueDate: "2026-12-04", totalCents: 78000, paidOn: null }, d("2026-11-05"));

function data(overrides: Partial<InvoiceMessageData> = {}): InvoiceMessageData {
  return {
    number: "BP-2026-0041",
    orderName: "#1031",
    totalCents: 78000,
    sellerName: "Blue Point Distribution",
    dueDate: d("2026-12-04"),
    paidOn: null,
    lines: [],
    earlyPayment: offer,
    ...overrides,
  };
}

/** Les espaces insécables du texte deviennent des espaces simples : on compare ce qui se lit. */
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, " ");

describe("rabais de paiement rapide dans les messages", () => {
  it("le dit dans l'e-mail, avec le montant et le dernier jour", () => {
    const text = plain(emailText(data()));
    expect(text).toContain("Rabais de 2");
    expect(text).toContain("14.11.2026");
    expect(text).toContain("CHF 764.40");
    expect(text).toContain("au lieu de CHF 780.00");
  });

  it("le dit dans le message WhatsApp, avant le lien du PDF", () => {
    const text = plain(whatsappMessage(data(), "https://exemple.ch/partage/x"));
    expect(text).toContain("CHF 764.40");
    expect(text.indexOf("Rabais")).toBeLessThan(text.indexOf("https://exemple.ch"));
  });

  it("n'en parle pas quand il n'y a pas de rabais", () => {
    expect(emailText(data({ earlyPayment: null }))).not.toContain("Rabais");
    expect(whatsappMessage(data({ earlyPayment: undefined }), "https://exemple.ch/x")).not.toContain("Rabais");
  });

  it("n'en parle pas dans un reçu déjà payé", () => {
    expect(emailText(data({ paidOn: d("2026-11-05") }))).not.toContain("Rabais");
  });
});
