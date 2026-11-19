import { describe, expect, it } from "vitest";
import { frenchTypography } from "./trial-typography";
import { tooLateForNote } from "./vente-bon-plan";
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

const SALE_ERASE =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai » (il efface aussi les bons), puis « Créer le bon de livraison » et « Faire la facture » sur la commande.";
const TEST_ORDER = { isTest: true, tooLate: false };
const REAL_ORDER = { isTest: false, tooLate: false };
const TOO_LATE = view("Facture faite avant les bons de livraison : pas de bon pour cette commande.", "info");

function view(text: string, tone: SaleNoteView["tone"], canCreate = false): SaleNoteView {
  return { text: frenchTypography(text), tone, canCreate };
}

describe("état du bon de livraison AbaNinja sur la fiche commande", () => {
  it("ne montre rien pour une vraie commande sans bon", () => {
    expect(saleNoteView(null, REAL_ORDER, NOW)).toBeNull();
  });

  it("propose de créer le bon d'une commande d'essai qui n'en a pas", () => {
    expect(saleNoteView(null, TEST_ORDER, NOW)).toEqual(view("Pas encore de bon de livraison dans AbaNinja. Touchez « Créer le bon de livraison » : s’il ne peut pas se faire, l’app dit pourquoi.", "info", true));
  });

  it("dit que le bon est en cours pendant les deux premières minutes", () => {
    expect(saleNoteView(sale(), TEST_ORDER, NOW)).toEqual(view("Bon de livraison en cours dans AbaNinja…", "info"));
  });

  it("commande d'essai déjà facturée ou livrée sans bon : pas de bouton, elle n'aura pas de bon", () => {
    expect(saleNoteView(null, { isTest: true, tooLate: true }, NOW)).toEqual(TOO_LATE);
  });

  it("bon refusé sur une commande facturée ou livrée depuis : pas de bouton non plus", () => {
    expect(saleNoteView(sale({ noteState: "refuse" }), { isTest: true, tooLate: true }, NOW)).toEqual(TOO_LATE);
  });

  it("demande de vérifier un bon resté en cours ou au résultat incertain", () => {
    const stuck = view(`Bon de livraison à vérifier dans AbaNinja (référence ${REF}). ${NOTE_ERASE}`, "warning");
    expect(saleNoteView(sale({ createdAt: new Date("2026-11-19T11:03:30Z") }), TEST_ORDER, NOW)).toEqual(stuck);
    expect(saleNoteView(sale({ noteState: "incertain" }), TEST_ORDER, NOW)).toEqual(stuck);
  });

  it("propose de recommencer un bon refusé", () => {
    expect(saleNoteView(sale({ noteState: "refuse" }), TEST_ORDER, NOW)).toEqual(view("Le bon de livraison n’a pas pu être fait. Touchez « Créer le bon de livraison » pour réessayer et voir pourquoi.", "critical", true));
  });

  it("bon refusé qui a laissé son client d'essai : le bouton le supprime d'abord, puis refait le bon", () => {
    const left = sale({ noteState: "refuse", addressUuid: "22222222-2222-4222-8222-222222222222", companyUuid: "33333333-3333-4333-8333-333333333333" });
    const retry = "Le bon de livraison n’a pas pu être fait et son client d’essai est resté dans AbaNinja. Touchez « Créer le bon de livraison » pour réessayer : l’app supprime d’abord ce client.";
    expect(saleNoteView(left, TEST_ORDER, NOW)).toEqual(view(retry, "critical", true));
    const tooLate = view(`Le bon de livraison n’a pas pu être fait et son client d’essai est resté dans AbaNinja. ${NOTE_ERASE}`, "critical");
    expect(saleNoteView(left, { isTest: true, tooLate: true }, NOW)).toEqual(tooLate);
  });

  it("donne le numéro du bon fait, ou sa référence s'il n'a pas encore de numéro", () => {
    expect(saleNoteView(sale({ noteState: "cree", noteNumber: "L00042" }), TEST_ORDER, NOW)).toEqual(view("Bon de livraison n° L00042 dans AbaNinja.", "success"));
    expect(saleNoteView(sale({ noteState: "cree" }), TEST_ORDER, NOW)).toEqual(view(`Bon de livraison fait dans AbaNinja (référence ${REF}).`, "success"));
  });

  it("facture commencée depuis moins de deux minutes : « en cours »", () => {
    const running = sale({ noteState: "cree", noteNumber: "L00042", invoiceState: "en_cours", updatedAt: new Date("2026-11-19T11:04:30Z") });
    expect(saleNoteView(running, TEST_ORDER, NOW)).toEqual(view("Facture en cours…", "info"));
  });

  it("facture restée en cours plus de deux minutes, ou incertaine : à vérifier dans AbaNinja", () => {
    const toCheck = view(`Facture à vérifier dans AbaNinja (référence ${REF}). ${SALE_ERASE}`, "warning");
    const stuck = sale({ noteState: "cree", invoiceState: "en_cours", updatedAt: new Date("2026-11-19T11:02:00Z") });
    expect(saleNoteView(stuck, TEST_ORDER, NOW)).toEqual(toCheck);
    expect(saleNoteView(sale({ noteState: "cree", invoiceState: "incertaine" }), TEST_ORDER, NOW)).toEqual(toCheck);
  });

  it("paiement pas sûr d'être inscrit depuis plus de deux minutes : avertit, même une fois le bon réglé", () => {
    const toCheck = view("Paiement de la facture R02292 à vérifier dans AbaNinja : inscrivez-le à la main s’il manque, avant de l’envoyer.", "warning");
    const unsure = { invoiceState: "creee", invoiceNumber: "R02292", paymentState: "incertain", updatedAt: new Date("2026-11-19T11:03:00Z") };
    expect(saleNoteView(sale({ noteState: "cree", ...unsure }), TEST_ORDER, NOW)).toEqual(toCheck);
    expect(saleNoteView(sale({ noteState: "converti", ...unsure }), TEST_ORDER, NOW)).toEqual(toCheck);
  });

  it("paiement en train d'être inscrit : patienter, ne surtout pas l'inscrire à la main", () => {
    const running = sale({ noteState: "converti", invoiceState: "creee", invoiceNumber: "R02292", paymentState: "incertain", updatedAt: new Date("2026-11-19T11:04:30Z") });
    expect(saleNoteView(running, TEST_ORDER, NOW)).toEqual(view("Paiement de la facture R02292 en cours d’inscription dans AbaNinja…", "info"));
  });

  it("dit que le bon est réglé par sa facture", () => {
    const converted = sale({ noteState: "converti", noteNumber: "L00042", invoiceNumber: "R02292" });
    expect(saleNoteView(converted, TEST_ORDER, NOW)).toEqual(view("Bon de livraison n° L00042 réglé : facture R02292 faite dans AbaNinja.", "success"));
    expect(saleNoteView({ ...converted, noteNumber: null, invoiceNumber: null }, TEST_ORDER, NOW)).toEqual(
      view("Bon de livraison réglé : facture faite dans AbaNinja.", "success"),
    );
  });

  it("dit que le bon d'une commande annulée est annulé", () => {
    expect(saleNoteView(sale({ noteState: "annule" }), TEST_ORDER, NOW)).toEqual(view("Bon de livraison annulé dans AbaNinja.", "info"));
  });
});

describe("trop tard pour un bon de livraison", () => {
  it("une copie de facture ou une livraison faite suffit ; une livraison annulée ne compte pas", () => {
    expect(tooLateForNote({ hasInvoice: true, fulfillments: [] })).toBe(true);
    expect(tooLateForNote({ hasInvoice: false, fulfillments: [{ status: "SUCCESS" }] })).toBe(true);
    expect(tooLateForNote({ hasInvoice: false, fulfillments: [{ status: "CANCELLED" }] })).toBe(false);
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
