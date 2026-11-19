import { describe, expect, it, vi } from "vitest";
import type { AbaNinjaDeliveryNoteInput } from "./delivery-note-input";
import {
  convertDeliveryNoteToInvoice,
  createDeliveryNote,
  deleteDeliveryNote,
  getDeliveryNote,
  listDeliveryNoteActionNames,
} from "./delivery-notes.server";
import { emptyResponse, jsonResponse, recordSleeps, scriptedFetch, TEST_ACCOUNT_UUID, testConfig, type Scripted } from "./test-support";

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const NOTE_UUID = "66666666-6666-4666-8666-666666666666";
const INVOICE_UUID = "77777777-7777-4777-8777-777777777777";
const COMPANY_UUID = "33333333-3333-4333-8333-333333333333";
const BASE = `https://api.abaninja.ch/accounts/${TEST_ACCOUNT_UUID}/documents/v2/delivery-notes`;

const input: AbaNinjaDeliveryNoteInput = {
  receiver: { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: COMPANY_UUID },
  reference: "BP-ESSAI-BL-1042-20261119-101500",
  deliveryNoteDate: "2026-11-19",
  deliveryDate: "2026-11-26",
  pricesIncludeVat: true,
  positions: [{ positionNumber: 1, description: "Alma Bio IGT · 75 cl", quantity: 12, unitPrice: 37.5, vatPercentage: 8.1 }],
};

function run(script: readonly Scripted[]) {
  const { fetchImpl, calls } = scriptedFetch(script);
  return { options: { fetchImpl, sleep: recordSleeps().sleep }, calls };
}

describe("bons de livraison AbaNinja", () => {
  it("crée le bon en une seule requête POST, jamais rejouée", async () => {
    const { options, calls } = run([jsonResponse({ data: { documents: [{ uuid: NOTE_UUID, status: "draft", deliveryNoteNumber: "BL-0001" }] } }, 201)]);
    const result = await createDeliveryNote(testConfig(), input, options);
    expect(result).toEqual({ ok: true, value: { kind: "cree", uuid: NOTE_UUID } });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(BASE);
    expect(calls[0]?.init.method).toBe("POST");
  });

  it("signale un résultat incertain quand AbaNinja met la création en file d'attente", async () => {
    const { options } = run([jsonResponse({ data: { status: "queued", queueUuid: "55555555-5555-4555-8555-555555555555" } }, 202)]);
    expect(await createDeliveryNote(testConfig(), input, options)).toEqual({ ok: true, value: { kind: "incertain" } });
  });

  it("refuse d'envoyer un bon invalide", async () => {
    const { options, calls } = run([emptyResponse(500)]);
    const result = await createDeliveryNote(testConfig(), { ...input, positions: [] }, options);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("relit le bon : statut, numéro, référence et client", async () => {
    const record = { uuid: NOTE_UUID, status: "draft", reference: input.reference, deliveryNoteNumber: null, receiver: { addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: COMPANY_UUID } };
    const { options, calls } = run([jsonResponse({ data: { documents: [record] } })]);
    expect(await getDeliveryNote(testConfig(), NOTE_UUID, options)).toEqual({
      ok: true,
      value: { uuid: NOTE_UUID, status: "draft", reference: input.reference, number: null, companyUuid: COMPANY_UUID },
    });
    expect(calls[0]?.url).toBe(`${BASE}/${NOTE_UUID}`);
  });

  it("transforme le bon en facture et renvoie la facture créée", async () => {
    const { options, calls } = run([jsonResponse({ data: { type: "invoice", uuid: INVOICE_UUID } })]);
    expect(await convertDeliveryNoteToInvoice(testConfig(), NOTE_UUID, options)).toEqual({ ok: true, value: INVOICE_UUID });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${BASE}/${NOTE_UUID}/actions/convertDNI`);
    expect(calls[0]?.init.method).toBe("PATCH");
  });

  it("refuse une conversion qui ne renvoie pas une facture", async () => {
    const { options } = run([jsonResponse({ data: { type: "credit_note", uuid: INVOICE_UUID } })]);
    expect((await convertDeliveryNoteToInvoice(testConfig(), NOTE_UUID, options)).ok).toBe(false);
  });

  it("supprime le bon par l'action « delete »", async () => {
    const { options, calls } = run([emptyResponse(204)]);
    expect(await deleteDeliveryNote(testConfig(), NOTE_UUID, options)).toEqual({ ok: true, value: undefined });
    expect(calls[0]?.url).toBe(`${BASE}/${NOTE_UUID}/actions/delete`);
  });

  it("liste les actions qu'AbaNinja autorise sur le bon", async () => {
    const { options, calls } = run([jsonResponse({ data: [{ name: "convertDNI" }, { name: "markSent" }, "delete"] })]);
    expect(await listDeliveryNoteActionNames(testConfig(), NOTE_UUID, options)).toEqual({ ok: true, value: ["convertDNI", "markSent", "delete"] });
    expect(calls[0]?.url).toBe(`${BASE}/${NOTE_UUID}/actions`);
    expect(calls[0]?.init.method).toBe("GET");
  });
});
