import { describe, expect, it } from "vitest";
import { frenchTypography } from "./trial-typography";
import { saleNoteActionResult, saleNoteView, type SaleNoteView } from "./vente-bon-view";
import type { AbaNinjaSale } from "./vente-repository.server";

const NOW = new Date("2026-11-19T11:05:30Z");
const REF = "BP-ESSAI-CMD-1042-20261119-110530";
const NOTE_ERASE =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai » (il efface aussi les bons), puis « Créer le bon de livraison » sur la commande.";

function sale(changes: Partial<AbaNinjaSale> = {}): AbaNinjaSale {
  return {
    id: "v1",
    shop: "test.myshopify.com",
    orderId: "gid://shopify/Order/1042",
    orderName: "#1042",
    isTest: true,
    reference: REF,
    noteState: "en_cours",
    noteUuid: null,
    noteNumber: null,
    addressUuid: null,
    companyUuid: null,
    invoiceState: null,
    invoiceUuid: null,
    invoiceNumber: null,
    paymentState: null,
    lastErrorCode: null,
    createdAt: new Date("2026-11-19T11:05:00Z"),
    updatedAt: new Date("2026-11-19T11:05:00Z"),
    ...changes,
  };
}

function view(text: string, tone: SaleNoteView["tone"], canCreate = false): SaleNoteView {
  return { text: frenchTypography(text), tone, canCreate };
}

describe("état du bon de livraison AbaNinja sur la fiche commande", () => {
  it("ne montre rien pour une vraie commande sans bon", () => {
    expect(saleNoteView(null, false, NOW)).toBeNull();
  });

  it("propose de créer le bon d'une commande d'essai qui n'en a pas", () => {
    expect(saleNoteView(null, true, NOW)).toEqual(view("Pas encore de bon de livraison dans AbaNinja. Touchez « Créer le bon de livraison » : s’il ne peut pas se faire, l’app dit pourquoi.", "info", true));
  });

  it("dit que le bon est en cours pendant les deux premières minutes", () => {
    expect(saleNoteView(sale(), true, NOW)).toEqual(view("Bon de livraison en cours dans AbaNinja…", "info"));
  });

  it("demande de vérifier un bon resté en cours ou au résultat incertain", () => {
    const stuck = view(`Bon de livraison à vérifier dans AbaNinja (référence ${REF}). ${NOTE_ERASE}`, "warning");
    expect(saleNoteView(sale({ createdAt: new Date("2026-11-19T11:03:30Z") }), true, NOW)).toEqual(stuck);
    expect(saleNoteView(sale({ noteState: "incertain" }), true, NOW)).toEqual(stuck);
  });

  it("propose de recommencer un bon refusé", () => {
    expect(saleNoteView(sale({ noteState: "refuse" }), true, NOW)).toEqual(view("Le bon de livraison n’a pas pu être fait. Touchez « Créer le bon de livraison » pour réessayer et voir pourquoi.", "critical", true));
  });

  it("donne le numéro du bon fait, ou sa référence s'il n'a pas encore de numéro", () => {
    expect(saleNoteView(sale({ noteState: "cree", noteNumber: "L00042" }), true, NOW)).toEqual(view("Bon de livraison n° L00042 dans AbaNinja.", "success"));
    expect(saleNoteView(sale({ noteState: "cree" }), true, NOW)).toEqual(view(`Bon de livraison fait dans AbaNinja (référence ${REF}).`, "success"));
  });

  it("dit que le bon est réglé par sa facture", () => {
    const converted = sale({ noteState: "converti", noteNumber: "L00042", invoiceNumber: "R02292" });
    expect(saleNoteView(converted, true, NOW)).toEqual(view("Bon de livraison n° L00042 réglé : facture R02292 faite dans AbaNinja.", "success"));
    expect(saleNoteView({ ...converted, noteNumber: null, invoiceNumber: null }, true, NOW)).toEqual(
      view("Bon de livraison réglé : facture faite dans AbaNinja.", "success"),
    );
  });

  it("dit que le bon d'une commande annulée est annulé", () => {
    expect(saleNoteView(sale({ noteState: "annule" }), true, NOW)).toEqual(view("Bon de livraison annulé dans AbaNinja.", "info"));
  });
});

describe("réponse au bouton « Créer le bon de livraison »", () => {
  it("dit en clair ce qui s'est passé", () => {
    expect(saleNoteActionResult({ kind: "cree", noteNumber: "L00042" })).toEqual({ intent: "bon-creer", ok: true, message: frenchTypography("Bon de livraison n° L00042 fait dans AbaNinja.") });
    expect(saleNoteActionResult({ kind: "cree", noteNumber: null })).toMatchObject({ ok: true, message: "Bon de livraison fait dans AbaNinja." });
    expect(saleNoteActionResult({ kind: "deja_fait" })).toMatchObject({ ok: true, message: "Cette commande a déjà son bon de livraison." });
    expect(saleNoteActionResult({ kind: "pas_concernee" })).toMatchObject({ ok: false, message: frenchTypography("Seules les commandes d’essai (étiquette « fictif ») ont un bon dans AbaNinja pour l’instant.") });
    expect(saleNoteActionResult({ kind: "refuse", message: "La commande a un rabais." })).toMatchObject({ ok: false, message: "La commande a un rabais." });
  });
});
