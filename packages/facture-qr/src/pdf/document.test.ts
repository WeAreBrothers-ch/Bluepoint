import { describe, expect, it } from "vitest";
import { FactureError } from "../erreurs";
import { FACTURE_EXEMPLE } from "../fixtures/facture";
import { QR_IBAN_EXEMPLE } from "../fixtures/vendeur";
import type { InvoiceInput } from "../schema";
import { validateInvoiceInput } from "../validation";
import { ajouterJours as ajouterJoursIso } from "../dates";
import { renderInvoicePdf } from "./document";

const facture = validateInvoiceInput(FACTURE_EXEMPLE);

function nombreDePages(pdf: Buffer): number {
  return pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
}

describe("renderInvoicePdf", () => {
  it("produit un PDF d'une page avec la QR-facture", async () => {
    const pdf = await renderInvoicePdf(facture);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(nombreDePages(pdf)).toBe(1);
  });

  it("produit une facture avec QR-IBAN et référence QR", async () => {
    const avecQr = validateInvoiceInput({ ...FACTURE_EXEMPLE, seller: { ...FACTURE_EXEMPLE.seller, qrIban: QR_IBAN_EXEMPLE } });
    const pdf = await renderInvoicePdf(avecQr);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("produit une facture acquittée d'une page, sans QR-facture", async () => {
    const acquittee = validateInvoiceInput({ ...FACTURE_EXEMPLE, paidOn: FACTURE_EXEMPLE.issueDate, dueDate: FACTURE_EXEMPLE.issueDate });
    const pdf = await renderInvoicePdf(acquittee);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(nombreDePages(pdf)).toBe(1);
    const avecQr = await renderInvoicePdf(facture);
    expect(pdf.length).toBeLessThan(avecQr.length);
  });

  it("passe sur plusieurs pages quand la commande est longue", async () => {
    const ligne = { description: "Chasselas Lavaux AOC", producer: "Domaine test", volumeLabel: "75 cl", quantity: 1, unitPriceCents: 2000, totalCents: 2000 };
    const longue = validateInvoiceInput({
      ...FACTURE_EXEMPLE,
      lines: Array.from({ length: 30 }, () => ligne),
      shipping: undefined,
      totalCents: 60000,
      vatLines: [{ ratePercent: 8.1, amountCents: 4496 }],
    });
    expect(nombreDePages(await renderInvoicePdf(longue))).toBeGreaterThan(1);
  });

  it("ajoute la mention du rabais de paiement rapide sans changer le nombre de pages", async () => {
    const total = facture.totalCents;
    const avecRabais = validateInvoiceInput({
      ...FACTURE_EXEMPLE,
      earlyPayment: { percent: 2, deadline: ajouterJoursIso(FACTURE_EXEMPLE.issueDate, 10), amountCents: Math.round(total * 0.98) },
    });
    const pdf = await renderInvoicePdf(avecRabais);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(nombreDePages(pdf)).toBe(1);
  });

  it("refuse un rabais qui n'en est pas un, ou dont le délai précède la facture", () => {
    const total = facture.totalCents;
    expect(() => validateInvoiceInput({ ...FACTURE_EXEMPLE, earlyPayment: { percent: 2, deadline: FACTURE_EXEMPLE.issueDate, amountCents: total } })).toThrow(FactureError);
    expect(() => validateInvoiceInput({ ...FACTURE_EXEMPLE, earlyPayment: { percent: 2, deadline: "2000-01-01", amountCents: total - 1 } })).toThrow(FactureError);
  });

  it("revalide les données et rejette une facture modifiée après validation", async () => {
    const modifiee: InvoiceInput = { ...facture, totalCents: 1 };
    await expect(renderInvoicePdf(modifiee)).rejects.toThrow(FactureError);
  });
});
