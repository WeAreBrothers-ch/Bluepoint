import { describe, expect, it, vi } from "vitest";
import type { AbaNinjaDeliveryNoteInput } from "./delivery-note-input";
import { cancelDeliveryNote, createDeliveryNote, markDeliveryNoteSent, updateDeliveryNote } from "./delivery-notes.server";
import type { AbaNinjaInvoiceInput } from "./invoice-input";
import { updateInvoice } from "./invoice-update.server";
import { recordPayment } from "./payments.server";
import { emptyResponse, jsonResponse, recordSleeps, scriptedFetch, TEST_ACCOUNT_UUID, testConfig, type Scripted } from "./test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const NOTE = "66666666-6666-4666-8666-666666666666";
const INVOICE = "77777777-7777-4777-8777-777777777777";
const RECEIVER = { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" };
const ROOT = `https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}`;
const POSITIONS = [{ positionNumber: 1, description: "Alma Bio IGT · 75 cl", quantity: 12, unitPrice: 37.5, vatPercentage: 8.1 }];

const note: AbaNinjaDeliveryNoteInput = {
  receiver: RECEIVER,
  reference: "BP-ESSAI-CMD-1042-20261119-110530",
  deliveryNoteDate: "2026-11-19",
  deliveryDate: "2026-11-26",
  pricesIncludeVat: true,
  positions: POSITIONS,
};

const invoice: AbaNinjaInvoiceInput = {
  receiver: RECEIVER,
  bankAccountUuid: "11111111-1111-4111-8111-111111111111",
  reference: note.reference,
  invoiceDate: "2026-11-26",
  dueDate: "2026-12-26",
  pricesIncludeVat: true,
  positions: POSITIONS,
};

function run(script: readonly Scripted[]) {
  const { fetchImpl, calls } = scriptedFetch(script);
  return { options: { fetchImpl, sleep: recordSleeps().sleep }, calls };
}

function bodyOf(init: RequestInit | undefined): unknown {
  return JSON.parse(String(init?.body));
}

describe("bon de livraison : mise à jour et annulation", () => {
  it("met à jour le bon avec le même corps que sa création (document entier)", async () => {
    const created = run([jsonResponse({ data: { documents: [{ uuid: NOTE }] } }, 201)]);
    await createDeliveryNote(testConfig(), note, created.options);
    const { options, calls } = run([jsonResponse({ data: { documents: [{ uuid: NOTE }] } })]);
    expect(await updateDeliveryNote(testConfig(), NOTE, note, options)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${ROOT}/documents/v2/delivery-notes/${NOTE}`);
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(bodyOf(calls[0]?.init)).toEqual(bodyOf(created.calls[0]?.init));
  });

  it("refuse d'envoyer une mise à jour invalide", async () => {
    const { options, calls } = run([emptyResponse(500)]);
    expect((await updateDeliveryNote(testConfig(), NOTE, { ...note, positions: [] }, options)).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("marque le bon comme envoyé, sans rien envoyer à personne (markSent)", async () => {
    const { options, calls } = run([jsonResponse({ data: {} })]);
    expect(await markDeliveryNoteSent(testConfig(), NOTE, options)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${ROOT}/documents/v2/delivery-notes/${NOTE}/actions/markSent`);
    expect(calls[0]?.init.method).toBe("PATCH");
  });

  it("annule le bon pour de bon (cancelPermanently)", async () => {
    const { options, calls } = run([jsonResponse({ data: {} })]);
    expect(await cancelDeliveryNote(testConfig(), NOTE, options)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${ROOT}/documents/v2/delivery-notes/${NOTE}/actions/cancelPermanently`);
    expect(calls[0]?.init.method).toBe("PATCH");
  });
});

describe("facture issue du bon : mise à jour", () => {
  it("complète la facture (compte QR, dates, lignes) en une requête PATCH", async () => {
    const { options, calls } = run([jsonResponse({ data: { documents: [{ uuid: INVOICE }] } })]);
    expect(await updateInvoice(testConfig(), INVOICE, invoice, options)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${ROOT}/documents/v2/invoices/${INVOICE}`);
    expect(calls[0]?.init.method).toBe("PATCH");
    expect(bodyOf(calls[0]?.init)).toMatchObject({ documents: [{ reference: note.reference, paymentInstructions: { bankAccountUuid: invoice.bankAccountUuid } }] });
  });
});

describe("paiement reçu", () => {
  const payment = { documentUuid: INVOICE, amountChf: 1551, paymentDate: "2026-11-18", paymentType: "DEBIT_CREDIT_CARD" as const, info: "Payé en ligne (shopify_payments)" };

  it("inscrit le paiement sur la facture, sans confirmation envoyée au client", async () => {
    const { options, calls } = run([jsonResponse({ data: {}, message: "ok", status: 201 }, 201)]);
    expect(await recordPayment(testConfig(), payment, options)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${ROOT}/finances/v2/payments`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(bodyOf(calls[0]?.init)).toEqual({
      paymentDirection: "IN",
      paymentType: "DEBIT_CREDIT_CARD",
      amount: 1551,
      currencyCode: "CHF",
      paymentDate: "2026-11-18",
      paymentInfo: "Payé en ligne (shopify_payments)",
      processing: { type: "receipt", documentUuid: INVOICE, sendPaymentConfirmation: false },
    });
  });

  it("n'inscrit jamais deux fois : pas de rejeu quand AbaNinja ne répond pas", async () => {
    const { options, calls } = run([emptyResponse(503), emptyResponse(503)]);
    expect((await recordPayment(testConfig(), payment, options)).ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("refuse un montant nul", async () => {
    const { options, calls } = run([emptyResponse(500)]);
    expect((await recordPayment(testConfig(), { ...payment, amountChf: 0 }, options)).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
