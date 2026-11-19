import { describe, expect, it } from "vitest";
import { isDeliveryNoteTrialIntent, parseDeliveryNoteTrialForm, readTrialDocuments } from "./bl-essai-form";

const NOTE = "66666666-6666-4666-8666-666666666666";
const INVOICE = "77777777-7777-4777-8777-777777777777";
const REFERENCE = "BP-ESSAI-BL-1028-20261119-101500";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("formulaire de l'essai bon de livraison", () => {
  it("reconnaît ses trois boutons et seulement eux", () => {
    expect(isDeliveryNoteTrialIntent(form({ intent: "bl-creer" }))).toBe(true);
    expect(isDeliveryNoteTrialIntent(form({ intent: "essai" }))).toBe(false);
  });

  it("lit la création avec une commande Shopify valide", () => {
    expect(parseDeliveryNoteTrialForm(form({ intent: "bl-creer", orderId: "gid://shopify/Order/1028" }))).toEqual({
      kind: "creer",
      orderId: "gid://shopify/Order/1028",
    });
    expect(parseDeliveryNoteTrialForm(form({ intent: "bl-creer", orderId: "gid://shopify/Customer/1" })).kind).toBe("refuse");
  });

  it("lit la transformation et l'effacement avec les documents d'essai", () => {
    const fields = { noteUuid: NOTE, invoiceUuid: "", reference: REFERENCE };
    expect(parseDeliveryNoteTrialForm(form({ intent: "bl-facturer", ...fields }))).toEqual({
      kind: "facturer",
      documents: { noteUuid: NOTE, invoiceUuid: null, reference: REFERENCE },
    });
    expect(parseDeliveryNoteTrialForm(form({ intent: "bl-effacer", ...fields, invoiceUuid: INVOICE }))).toEqual({
      kind: "effacer",
      documents: { noteUuid: NOTE, invoiceUuid: INVOICE, reference: REFERENCE },
    });
  });

  it("refuse un identifiant ou une référence qui ne sont pas ceux d'un essai", () => {
    expect(parseDeliveryNoteTrialForm(form({ intent: "bl-effacer", noteUuid: "abc", reference: REFERENCE })).kind).toBe("refuse");
    expect(parseDeliveryNoteTrialForm(form({ intent: "bl-effacer", noteUuid: NOTE, reference: "R02279" })).kind).toBe("refuse");
  });

  it("relit les documents gardés par le navigateur, ou rien s'ils sont abîmés", () => {
    expect(readTrialDocuments({ noteUuid: NOTE, invoiceUuid: null, reference: REFERENCE })).toEqual({ noteUuid: NOTE, invoiceUuid: null, reference: REFERENCE });
    expect(readTrialDocuments({ noteUuid: 3 })).toBeNull();
    expect(readTrialDocuments(null)).toBeNull();
  });
});
