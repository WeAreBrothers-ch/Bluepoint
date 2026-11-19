import { describe, expect, it } from "vitest";
import { validateInvoiceInput, type InvoiceInput, type InvoiceInputRaw } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import { planTestSaleInvoice, SALE_TEST_PREFIX } from "./vente-plan";
import { invoiceInputSchema } from "./invoice-input";

const NOW = new Date("2026-11-19T11:05:30Z");

function order(changes: Partial<InvoiceInputRaw> = {}): InvoiceInput {
  return validateInvoiceInput({ ...FACTURE_EXEMPLE, ...changes });
}

function planOf(input: InvoiceInput, forPro = false) {
  const result = planTestSaleInvoice(input, NOW, forPro);
  if (!result.ok) throw result.error;
  return result.value;
}

function refusalOf(input: InvoiceInput): string {
  const result = planTestSaleInvoice(input, NOW, false);
  if (result.ok) throw new Error("La commande aurait dû être refusée.");
  return result.error.message;
}

describe("facture AbaNinja d'une commande fictive livrée", () => {
  it("reprend chaque vin et la livraison, TVA comprise, au même total que la commande", () => {
    const plan = planOf(order());
    expect(plan.invoice.pricesIncludeVat).toBe(true);
    expect(plan.invoice.positions).toEqual([
      { positionNumber: 1, description: "Merlot del Ticino Picaia 2022 · 75 cl — Bianchi", quantity: 36, unitPrice: 24, vatPercentage: 8.1 },
      { positionNumber: 2, description: "Alma Bio IGT · 75 cl — Bianchi", quantity: 24, unitPrice: 28, vatPercentage: 8.1 },
      { positionNumber: 3, description: "Livraison", quantity: 1, unitPrice: 15, vatPercentage: 8.1 },
    ]);
    const total = plan.invoice.positions.reduce((sum, p) => sum + p.unitPrice * 100 * p.quantity, 0);
    expect(total).toBe(155_100);
  });

  it("date la facture du jour, garde l'échéance et écrit la date de livraison (obligatoire pour la TVA)", () => {
    const plan = planOf(order());
    expect(plan.invoice.invoiceDate).toBe("2026-10-21");
    expect(plan.invoice.dueDate).toBe("2026-11-20");
    expect(plan.invoice.publicNotes).toBe("Commande #1042, livrée le 20.10.2026.");
    expect(plan.invoice.terms).toBe("Payable à 30 jours");
  });

  it("donne une référence et un client d'essai uniques, faciles à retrouver et à supprimer", () => {
    const plan = planOf(order());
    expect(plan.reference).toBe(`${SALE_TEST_PREFIX}1042-20261119-110530`);
    expect(plan.invoice.reference).toBe(plan.reference);
    expect(plan.clientName).toBe("Restaurant Le Pressoir · essai BluePoint 20261119-110530 (à supprimer)");
    expect(plan.clientAddress).toMatchObject({ kind: "company", name: plan.clientName, email: "essai-fact-20261119-110530@example.com" });
    expect(plan.sharedClient).toBe(false);
  });

  it("commande fictive d'un pro : la facture va au client pro fictif, le même que celui des bons", () => {
    const plan = planOf(order(), true);
    expect(plan.sharedClient).toBe(true);
    expect(plan.clientName).toBe("Client pro fictif · essai BluePoint");
    expect(plan.clientAddress).toMatchObject({ kind: "company", name: plan.clientName, email: "client-pro-fictif@example.com" });
  });

  it("produit une facture que la validation AbaNinja accepte", () => {
    const plan = planOf(order());
    const uuid = "9b2c1f4e-7a3d-4c8b-9e5f-0a1b2c3d4e5f";
    const parsed = invoiceInputSchema.safeParse({ ...plan.invoice, receiver: { addressUuid: uuid, companyUuid: uuid }, bankAccountUuid: uuid });
    expect(parsed.success).toBe(true);
  });

  it("prend le nom de la personne quand la commande n'a pas d'entreprise", () => {
    const plan = planOf(order({ buyer: { name: "Camille Fictive", city: "Vevey", country: "CH" } }));
    expect(plan.clientName.startsWith("Camille Fictive · essai BluePoint")).toBe(true);
  });

  it("refuse une commande avec un rabais, sans rien préparer", () => {
    const discounted = order({
      discounts: [{ label: "Prix pro", amountCents: 1000 }],
      totalCents: 154_100,
      vatLines: [{ ratePercent: 8.1, amountCents: 11547 }],
    });
    expect(refusalOf(discounted)).toContain("rabais");
  });

  it("refuse une commande à plusieurs taux de TVA", () => {
    const mixed = order({ vatLines: [{ ratePercent: 8.1, amountCents: 11000 }, { ratePercent: 2.6, amountCents: 622 }] });
    expect(refusalOf(mixed)).toContain("plusieurs taux de TVA");
  });

  it("refuse une commande dont les lignes ne font pas le total (contrôle de plus que celui du moteur de facture)", () => {
    expect(refusalOf({ ...order(), totalCents: 155_200 })).toContain("total");
  });
});
