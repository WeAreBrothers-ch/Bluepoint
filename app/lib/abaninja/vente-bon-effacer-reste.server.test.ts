import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";
import { answerAsUsual, CLIENT, COMPANY, invoice, NO_INVOICE, NOTE, NOW, REF, sale } from "./vente-bon-effacer.test-support";

/** Ce que l'effacement laisse dans AbaNinja est toujours nommé, et une coupure d'AbaNinja ne fait rien oublier. */

const api = vi.hoisted(() => ({
  listTestSales: vi.fn(),
  getInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  getDeliveryNote: vi.fn(),
  deleteDeliveryNote: vi.fn(),
  deleteCompany: vi.fn(),
}));
const tx = vi.hoisted(() => ({
  invoice: { findFirst: vi.fn(), delete: vi.fn() },
  storedFile: { deleteMany: vi.fn() },
  abaNinjaSale: { deleteMany: vi.fn() },
}));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("./vente-repository.server", () => ({ listTestSales: api.listTestSales }));
vi.mock("./invoices.server", () => ({ getInvoice: api.getInvoice }));
vi.mock("./invoice-cleanup.server", () => ({ deleteInvoice: api.deleteInvoice, deleteCompany: api.deleteCompany }));
vi.mock("./delivery-notes.server", () => ({ getDeliveryNote: api.getDeliveryNote, deleteDeliveryNote: api.deleteDeliveryNote }));

const { eraseTestSaleNotes } = await import("./vente-bon-effacer.server");

const NOTE_NAME = `le bon L00042 (référence ${REF})`;

async function eraseOne() {
  const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", null, NOW);
  return outcome;
}

beforeEach(() => {
  vi.clearAllMocks();
  answerAsUsual(api, tx);
});

describe("ce qui reste dans AbaNinja est nommé", () => {
  it("facture à une autre référence : le bon et le client restés sont nommés, à supprimer à la main", async () => {
    api.getInvoice.mockResolvedValue(invoice("draft", "BP-1035"));
    expect(await eraseOne()).toEqual({
      kind: "a_la_main",
      text: `#1035 : la facture R02292 trouvée dans AbaNinja ne porte pas la référence de l’essai (${REF}) : l’app n’efface ni cette facture, ni ${NOTE_NAME}, ni ${CLIENT}. Vérifiez-la dans AbaNinja. Supprimez ensuite à la main le bon et le client.`,
    });
  });

  it("facture payée : le bon et le client restés sont nommés", async () => {
    api.getInvoice.mockResolvedValue(invoice("paid"));
    expect(await eraseOne()).toEqual({
      kind: "a_la_main",
      text: `#1035 : la facture R02292 est payée dans AbaNinja : l’app n’efface ni cette facture, ni ${NOTE_NAME}, ni ${CLIENT}. Supprimez d’abord son paiement dans AbaNinja, puis annulez la facture. Supprimez ensuite à la main le bon et le client.`,
    });
  });

  it("bon à une autre référence : son numéro et le client resté sont nommés", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "cree", ...NO_INVOICE })]));
    api.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "draft", reference: "BL-1035", number: "L00042", companyUuid: COMPANY }));
    expect(await eraseOne()).toEqual({
      kind: "a_la_main",
      text: `#1035 : le bon L00042 trouvé dans AbaNinja ne porte pas la référence de l’essai (${REF}) : l’app n’efface ni ce bon ni ${CLIENT}. Vérifiez-le dans AbaNinja, puis supprimez à la main le client.`,
    });
  });
});

describe("une coupure d'AbaNinja ne fait rien oublier", () => {
  it("client d'essai pas supprimé faute de réponse : l'essai est gardé pour réessayer", async () => {
    api.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    expect(await eraseOne()).toEqual({ kind: "gardee", text: "#1035 : bon et facture effacés, mais AbaNinja n’a pas répondu pour le client d’essai. Réessayez dans un instant." });
    expect(tx.abaNinjaSale.deleteMany).not.toHaveBeenCalled();
  });

  it("bon non confirmé, AbaNinja ne répond pas pour le client : gardé", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "incertain", noteUuid: null, noteNumber: null, ...NO_INVOICE })]));
    api.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("indisponible", { status: 503 })));
    expect(await eraseOne()).toMatchObject({ kind: "gardee" });
    expect(tx.abaNinjaSale.deleteMany).not.toHaveBeenCalled();
  });

  it("bon non confirmé dont le client n'existe déjà plus : Eliott cherche seulement le bon", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "incertain", noteUuid: null, noteNumber: null, ...NO_INVOICE })]));
    api.deleteCompany.mockResolvedValue(failure(new AbaNinjaError("introuvable", { status: 404 })));
    expect(await eraseOne()).toMatchObject({ kind: "a_la_main", text: expect.stringContaining("le client d’essai est effacé") });
  });
});

describe("le rapport accorde les pièces effacées", () => {
  it("bon seul, sans client noté : « bon effacé »", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ noteState: "cree", companyUuid: null, addressUuid: null, ...NO_INVOICE })]));
    api.getDeliveryNote.mockResolvedValue(success({ uuid: NOTE, status: "draft", reference: REF, number: "L00042", companyUuid: COMPANY }));
    expect(await eraseOne()).toEqual({ kind: "effacee", text: "#1035 : bon effacé." });
  });

  it("tout effacé : « bon, facture et client d'essai effacés »", async () => {
    expect(await eraseOne()).toEqual({ kind: "effacee", text: "#1035 : bon, facture et client d’essai effacés." });
  });
});
