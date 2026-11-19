import { beforeEach, describe, expect, it, vi } from "vitest";
import { failure, success } from "../core/result";
import { AbaNinjaError } from "./errors";
import { testConfig } from "./test-support";
import { answerAsUsual, COMPANY, invoice, NO_INVOICE, NOW, REF, sale } from "./vente-bon-effacer.test-support";

/**
 * Effacer un essai dont le bon et la facture vont au client pro fictif : les pièces partent, le client reste
 * (il est effacé une seule fois, à la fin), et les textes ne demandent jamais de le supprimer à la main.
 */

const api = vi.hoisted(() => ({
  listTestSales: vi.fn(),
  getInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  getDeliveryNote: vi.fn(),
  deleteDeliveryNote: vi.fn(),
  deleteCompany: vi.fn(),
}));
const tx = vi.hoisted(() => ({ invoice: { findFirst: vi.fn(), delete: vi.fn() }, storedFile: { deleteMany: vi.fn() }, abaNinjaSale: { deleteMany: vi.fn() } }));

vi.mock("../core/logger.server", () => ({ logInfo: vi.fn(), logError: vi.fn() }));
vi.mock("../../db.server", () => ({ default: { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) } }));
vi.mock("./vente-repository.server", () => ({ listTestSales: api.listTestSales }));
vi.mock("./invoices.server", () => ({ getInvoice: api.getInvoice }));
vi.mock("./invoice-cleanup.server", () => ({ deleteInvoice: api.deleteInvoice, deleteCompany: api.deleteCompany }));
vi.mock("./delivery-notes.server", () => ({ getDeliveryNote: api.getDeliveryNote, deleteDeliveryNote: api.deleteDeliveryNote }));

const { eraseTestSaleNotes } = await import("./vente-bon-effacer.server");

const NOTE_NAME = `le bon L00042 (référence ${REF})`;

async function eraseOne() {
  const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", COMPANY, NOW);
  return outcome;
}

beforeEach(() => {
  vi.clearAllMocks();
  answerAsUsual(api, tx);
});

describe("essai rattaché au client pro fictif", () => {
  it("la facture et le bon partent, le client pro fictif reste pour la fin", async () => {
    expect(await eraseOne()).toEqual({ kind: "effacee", text: "#1035 : bon et facture effacés." });
    expect(api.deleteCompany).not.toHaveBeenCalled();
    expect(tx.abaNinjaSale.deleteMany).toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("un client d'essai propre à l'essai est toujours effacé avec lui", async () => {
    const [outcome] = await eraseTestSaleNotes(testConfig(), "test.myshopify.com", "44444444-4444-4444-8444-444444444444", NOW);
    expect(outcome).toEqual({ kind: "effacee", text: "#1035 : bon, facture et client d’essai effacés." });
    expect(api.deleteCompany).toHaveBeenCalledWith(expect.anything(), COMPANY);
  });

  it("bon jamais confirmé : seul le bon est à chercher, le client pro fictif n'est pas touché", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ ...NO_INVOICE, noteUuid: null, noteNumber: null, noteState: "incertain" })]));
    expect(await eraseOne()).toEqual({ kind: "a_la_main", text: `#1035 : cherchez dans AbaNinja un bon de livraison de référence ${REF} et supprimez-le s’il existe.` });
    expect(api.deleteCompany).not.toHaveBeenCalled();
  });

  it("facture jamais confirmée : la facture et le bon sont à chercher, pas le client", async () => {
    api.listTestSales.mockResolvedValue(success([sale({ invoiceUuid: null, invoiceNumber: null, invoiceState: "incertaine" })]));
    const text = `#1035 : cherchez dans AbaNinja une facture de référence ${REF} et ${NOTE_NAME}, et supprimez-les s’ils existent.`;
    expect(await eraseOne()).toEqual({ kind: "a_la_main", text });
  });

  it("facture payée : la facture et le bon restés sont nommés, pas le client", async () => {
    api.getInvoice.mockResolvedValue(invoice("paid"));
    const untouched = `l’app n’efface ni cette facture, ni ${NOTE_NAME}.`;
    const todo = "Supprimez d’abord son paiement dans AbaNinja, puis annulez la facture. Supprimez ensuite à la main le bon.";
    expect(await eraseOne()).toEqual({ kind: "a_la_main", text: `#1035 : la facture R02292 est payée dans AbaNinja : ${untouched} ${todo}` });
  });

  it("bon à une autre référence : seul ce bon est à vérifier", async () => {
    api.getInvoice.mockResolvedValue(invoice("cancelled"));
    api.getDeliveryNote.mockResolvedValue(success({ uuid: "n", status: "draft", reference: "AUTRE", number: "L00042", companyUuid: COMPANY }));
    const text = `#1035 : le bon L00042 trouvé dans AbaNinja ne porte pas la référence de l’essai (${REF}) : l’app n’efface pas ce bon. Vérifiez-le dans AbaNinja.`;
    expect(await eraseOne()).toEqual({ kind: "a_la_main", text });
  });

  it("bon qu'AbaNinja refuse d'effacer : seul le bon est à supprimer à la main", async () => {
    api.getInvoice.mockResolvedValue(invoice("cancelled"));
    api.deleteDeliveryNote.mockResolvedValue(failure(new AbaNinjaError("donnees_refusees", { status: 422 })));
    expect(await eraseOne()).toEqual({ kind: "a_la_main", text: `#1035 : AbaNinja refuse d’effacer ${NOTE_NAME} : supprimez-le à la main.` });
  });
});
