import { describe, expect, it } from "vitest";
import { validateInvoiceInput, type InvoiceInput, type InvoiceInputRaw } from "@bluepoint/facture-qr";
import { FACTURE_EXEMPLE } from "../../../packages/facture-qr/src/fixtures/facture";
import { deliveryNoteInputSchema } from "./delivery-note-input";
import { planTestSaleNote, saleNoteBody, SALE_NOTE_TEST_PREFIX } from "./vente-bon-plan";

const NOW = new Date("2026-11-19T11:05:30Z");
const RECEIVER = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };

function order(changes: Partial<InvoiceInputRaw> = {}): InvoiceInput {
  return validateInvoiceInput({ ...FACTURE_EXEMPLE, ...changes });
}

function planOf(input: InvoiceInput, plannedDate: string | null = null) {
  const result = planTestSaleNote(input, plannedDate, NOW);
  if (!result.ok) throw result.error;
  return result.value;
}

function refusalOf(input: InvoiceInput): string {
  const result = planTestSaleNote(input, null, NOW);
  if (result.ok) throw new Error("La commande aurait dû être refusée.");
  return result.error.message;
}

describe("bon de livraison AbaNinja d'une commande fictive", () => {
  it("reprend chaque vin et la livraison, TVA comprise, comme la facture", () => {
    const plan = planOf(order());
    expect(plan.note.pricesIncludeVat).toBe(true);
    expect(plan.note.positions).toEqual([
      { positionNumber: 1, description: "Merlot del Ticino Picaia 2022 · 75 cl — Bianchi", quantity: 36, unitPrice: 24, vatPercentage: 8.1 },
      { positionNumber: 2, description: "Alma Bio IGT · 75 cl — Bianchi", quantity: 24, unitPrice: 28, vatPercentage: 8.1 },
      { positionNumber: 3, description: "Livraison", quantity: 1, unitPrice: 15, vatPercentage: 8.1 },
    ]);
  });

  it("donne une référence et un client d'essai uniques, faciles à retrouver et à supprimer", () => {
    const plan = planOf(order());
    expect(plan.reference).toBe(`${SALE_NOTE_TEST_PREFIX}1042-20261119-110530`);
    expect(plan.reference).toBe("BP-ESSAI-CMD-1042-20261119-110530");
    expect(plan.note.reference).toBe(plan.reference);
    expect(plan.note.title).toBe("Bon de livraison #1042 (essai)");
    expect(plan.clientName).toBe("Restaurant Le Pressoir · essai BluePoint 20261119-110530 (à supprimer)");
    expect(plan.clientAddress).toMatchObject({ kind: "company", name: plan.clientName, email: "essai-cmd-20261119-110530@example.com" });
  });

  it("date le bon du jour ; livraison prévue au jour choisi, jamais dans le passé", () => {
    expect(planOf(order()).note).toMatchObject({ deliveryNoteDate: "2026-11-19", deliveryDate: "2026-11-19" });
    expect(planOf(order(), "2026-11-25").note.deliveryDate).toBe("2026-11-25");
    expect(planOf(order(), "2026-11-01").note.deliveryDate).toBe("2026-11-19");
  });

  it("produit un bon que la validation AbaNinja accepte", () => {
    const parsed = deliveryNoteInputSchema.safeParse({ ...planOf(order()).note, receiver: RECEIVER });
    expect(parsed.success).toBe(true);
  });

  it("refait le corps du bon d'une commande modifiée en gardant sa référence et sa date", () => {
    const body = saleNoteBody(order(), { reference: "BP-ESSAI-CMD-1042-20261118-090000", orderName: "#1042", noteDate: "2026-11-18", deliveryDate: "2026-11-21" });
    expect(body).toMatchObject({ ok: true, value: { reference: "BP-ESSAI-CMD-1042-20261118-090000", deliveryNoteDate: "2026-11-18", deliveryDate: "2026-11-21" } });
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

  it("refuse une commande dont les lignes ne font pas le total", () => {
    expect(refusalOf({ ...order(), totalCents: 155_200 })).toContain("total");
  });
});
