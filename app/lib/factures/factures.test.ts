import { NNBSP } from "../format/typography";
import { describe, expect, it } from "vitest";
import type { IsoDate } from "../metafields/definitions";
import { contactOf, deliveryDateOf } from "./delivery-date";
import { formatChf } from "../format/money";
import { emailSubject, emailText, orderSummary, whatsappMessage } from "./messages";
import { formatInvoiceNumber, yearOfIsoDate } from "./numbering";
import { INVOICE_ORDER_QUERY } from "./order-query";
import { firstValidPhone, normalizePhoneE164, whatsappUrl } from "./phone";

describe("numéros de facture", () => {
  it("formate BP-AAAA-NNNN", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("BP-2026-0001");
    expect(formatInvoiceNumber(2026, 42)).toBe("BP-2026-0042");
    expect(formatInvoiceNumber(2026, 12345)).toBe("BP-2026-12345");
  });

  it("refuse une séquence ou une année invalide", () => {
    expect(() => formatInvoiceNumber(2026, 0)).toThrow(RangeError);
    expect(() => formatInvoiceNumber(26, 1)).toThrow(RangeError);
    expect(yearOfIsoDate("2027-01-01")).toBe(2027);
    expect(() => yearOfIsoDate("01.01.2027")).toThrow(RangeError);
  });
});

describe("téléphone E.164", () => {
  it("convertit les numéros suisses", () => {
    expect(normalizePhoneE164("079 606 33 22")).toBe("+41796063322");
    expect(normalizePhoneE164("0041 79 606 33 22")).toBe("+41796063322");
    expect(normalizePhoneE164("+41 (0)79 606 33 22")).toBe("+41796063322");
    expect(normalizePhoneE164("+41.21.791.00.00")).toBe("+41217910000");
  });

  it("garde les numéros étrangers et refuse l'illisible", () => {
    expect(normalizePhoneE164("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhoneE164("+41 79 606")).toBeNull();
    expect(normalizePhoneE164("606 33 22")).toBeNull();
    expect(normalizePhoneE164("")).toBeNull();
    expect(firstValidPhone([null, "abc", "021 791 00 00"])).toBe("+41217910000");
  });

  it("construit le lien wa.me sans le +", () => {
    expect(whatsappUrl("+41796063322", "Bonjour à vous")).toBe("https://wa.me/41796063322?text=Bonjour%20%C3%A0%20vous");
  });
});

describe("date de livraison et contact", () => {
  it("prend la dernière expédition réussie, à l'heure suisse", () => {
    expect(
      deliveryDateOf([
        { status: "SUCCESS", createdAt: "2026-10-19T08:00:00Z", deliveredAt: null },
        { status: "SUCCESS", createdAt: "2026-10-20T08:00:00Z", deliveredAt: "2026-10-20T22:30:00Z" },
        { status: "CANCELLED", createdAt: "2026-10-25T08:00:00Z", deliveredAt: null },
      ]),
    ).toBe("2026-10-21");
    expect(deliveryDateOf([])).toBeNull();
  });

  it("trouve l'e-mail et le téléphone du client", () => {
    const contact = contactOf({
      email: null,
      phone: null,
      customer: { defaultEmailAddress: { emailAddress: "a@b.ch" }, defaultPhoneNumber: { phoneNumber: "+41796063322" } },
      shippingAddress: { phone: "021 791 00 00" },
      billingAddress: null,
      fulfillments: [],
    });
    expect(contact).toEqual({ email: "a@b.ch", phone: "+41217910000" });
  });
});

describe("messages", () => {
  const data = {
    number: "BP-2026-0042",
    orderName: "#1042",
    totalCents: 155100,
    sellerName: "Blue Point Distribution Sàrl",
    dueDate: "2026-11-20" as IsoDate,
    paidOn: null,
    lines: [
      { quantity: 12, label: "Dézaley Marsens" },
      { quantity: 6, label: "Col del Forno" },
    ],
  };

  it("rédige le message WhatsApp avec le récapitulatif, le lien et la typographie suisse", () => {
    const message = whatsappMessage(data, "https://app.example/partage/x");
    expect(message).toContain("voici votre facture BP-2026-0042 pour la commande #1042");
    expect(message).toContain("– 12 × Dézaley Marsens\n– 6 × Col del Forno");
    expect(message).toContain(formatChf(155100));
    expect(message).toContain("20.11.2026");
    expect(message).toContain(`bancaire${NNBSP}: https://app.example/partage/x`);
    expect(message).toContain(`bientôt${NNBSP}!`);
  });

  it("rédige l'e-mail avec un objet qui nomme la commande", () => {
    expect(emailSubject(data)).toBe("Facture BP-2026-0042 — commande #1042 — Blue Point Distribution Sàrl");
    const text = emailText(data);
    expect(text).toContain(`Récapitulatif de la commande${NNBSP}:`);
    expect(text).toContain("– 12 × Dézaley Marsens");
    expect(emailText({ ...data, dueDate: null })).not.toContain("régler");
  });

  it("remplace la pièce jointe par le lien du PDF quand l'e-mail part de la messagerie", () => {
    const text = emailText(data, "https://app.example/partage/abc");
    expect(text).toContain(`QR-facture pour payer depuis votre app bancaire${NNBSP}: https://app.example/partage/abc`);
    expect(text).not.toContain("pièce jointe");
    const recu = emailText({ ...data, paidOn: "2026-10-22" as IsoDate }, "https://app.example/partage/abc");
    expect(recu).toContain(`Le reçu en PDF${NNBSP}: https://app.example/partage/abc`);
  });

  it("reste correct sans récapitulatif (Shopify indisponible)", () => {
    const text = emailText({ ...data, lines: [] });
    expect(text).not.toContain("Récapitulatif");
    expect(text).toContain(`Total${NNBSP}: ${formatChf(155100)}`);
  });

  it("rédige le reçu : facture acquittée, rien à payer", () => {
    const recu = { ...data, paidOn: "2026-10-22" as IsoDate };
    expect(emailSubject(recu)).toBe("Reçu BP-2026-0042 — commande #1042 — Blue Point Distribution Sàrl");
    const text = emailText(recu);
    expect(text).toContain("Voici votre reçu BP-2026-0042 pour la commande #1042.");
    expect(text).toContain(formatChf(155100));
    expect(text).toContain("22.10.2026");
    expect(text).toContain("Aucun autre paiement n’est dû");
    expect(text).not.toContain("QR-facture");
    expect(whatsappMessage(recu, "https://app.example/partage/x")).toContain("reçu BP-2026-0042");
  });

  it("résume les longues commandes et renvoie au PDF", () => {
    const lines = Array.from({ length: 14 }, (_, index) => ({ quantity: 1, label: `Vin ${index + 1}` }));
    const summary = orderSummary(lines);
    expect(summary).toHaveLength(13);
    expect(summary.at(-1)).toBe("– et 2 autres produits (voir le PDF)");
  });
});

describe("requête de facture", () => {
  it("ne demande pas le champ Customer.email, absent du schéma 2026-10", () => {
    // `Customer.email` n'existe plus en Admin API 2026-10 : la requête ne doit pas le demander.
    expect(INVOICE_ORDER_QUERY).toContain("defaultEmailAddress { emailAddress }");
    expect(INVOICE_ORDER_QUERY).not.toMatch(/displayName\s+email/);
  });
});
