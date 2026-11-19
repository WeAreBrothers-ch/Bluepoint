import type { AbaNinjaSale } from "@prisma/client";
import { frenchTypography } from "./trial-typography";
import { NOTE_TOO_LATE } from "./vente-bon-plan";
import type { SaleNoteOutcome } from "./vente-bon.server";
import { NOTE_ERASE_HINT, SALE_ERASE_HINT } from "./vente-errors";

/** Ce que la fiche commande dit du bon de livraison AbaNinja, et la réponse au bouton qui le crée. Logique pure. */

export interface SaleNoteView {
  readonly text: string;
  readonly tone: "success" | "info" | "warning" | "critical";
  /** Afficher « Créer le bon de livraison ». */
  readonly canCreate: boolean;
}

/** La commande, vue de sa fiche. */
export interface SaleNoteOrder {
  readonly isTest: boolean;
  /** Facturée ou livrée avant les bons de livraison : pas de bon, pas de bouton. */
  readonly tooLate: boolean;
}

export const SALE_NOTE_INTENT = "bon-creer";

export interface SaleNoteActionResult {
  readonly intent: typeof SALE_NOTE_INTENT;
  readonly ok: boolean;
  readonly message: string;
}

/** Au-delà, un bon ou une facture « en cours » n'avance plus : la création s'est arrêtée en route. */
const STUCK_AFTER_MS = 2 * 60 * 1000;

function shown(text: string, tone: SaleNoteView["tone"], canCreate = false): SaleNoteView {
  return { text: frenchTypography(text), tone, canCreate };
}

function toCheck(sale: AbaNinjaSale): SaleNoteView {
  return shown(`Bon de livraison à vérifier dans AbaNinja (référence ${sale.reference}). ${NOTE_ERASE_HINT}`, "warning");
}

function stillFresh(since: Date, now: Date): boolean {
  return now.getTime() - since.getTime() < STUCK_AFTER_MS;
}

/** La facture née du bon est en doute (en cours, incertaine, ou paiement en cours ou pas sûr) ; null si rien ne l'est. */
function invoiceDoubt(sale: AbaNinjaSale, now: Date): SaleNoteView | null {
  if (sale.invoiceState === "en_cours" && stillFresh(sale.updatedAt, now)) return shown("Facture en cours…", "info");
  if (sale.invoiceState === "en_cours" || sale.invoiceState === "incertaine") {
    return shown(`Facture à vérifier dans AbaNinja (référence ${sale.reference}). ${SALE_ERASE_HINT}`, "warning");
  }
  if (sale.paymentState !== "incertain") return null;
  const invoice = sale.invoiceNumber === null ? "la facture" : `la facture ${sale.invoiceNumber}`;
  // Réservé juste avant l'envoi : pendant l'inscription, le dire à la main ferait un deuxième paiement.
  if (stillFresh(sale.updatedAt, now)) return shown(`Paiement de ${invoice} en cours d’inscription dans AbaNinja…`, "info");
  return shown(`Paiement de ${invoice} à vérifier dans AbaNinja : inscrivez-le à la main s’il manque, avant de l’envoyer.`, "warning");
}

function madeNote(sale: AbaNinjaSale): SaleNoteView {
  return sale.noteNumber === null
    ? shown(`Bon de livraison fait dans AbaNinja (référence ${sale.reference}).`, "success")
    : shown(`Bon de livraison n° ${sale.noteNumber} dans AbaNinja.`, "success");
}

function converted(sale: AbaNinjaSale): SaleNoteView {
  const note = sale.noteNumber === null ? "Bon de livraison" : `Bon de livraison n° ${sale.noteNumber}`;
  const invoice = sale.invoiceNumber === null ? "facture" : `facture ${sale.invoiceNumber}`;
  return shown(`${note} réglé : ${invoice} faite dans AbaNinja.`, "success");
}

function noNoteYet(order: SaleNoteOrder): SaleNoteView | null {
  if (!order.isTest) return null;
  if (order.tooLate) return shown(NOTE_TOO_LATE, "info");
  return shown("Pas encore de bon de livraison dans AbaNinja. Touchez « Créer le bon de livraison » : s’il ne peut pas se faire, l’app dit pourquoi.", "info", true);
}

/** Un client d'essai resté dans AbaNinja est supprimé par le nouvel essai ; sans nouvel essai possible, par l'effacement. */
function refusedNote(sale: AbaNinjaSale, order: SaleNoteOrder): SaleNoteView {
  const left = "Le bon de livraison n’a pas pu être fait et son client d’essai est resté dans AbaNinja.";
  if (sale.companyUuid !== null && order.tooLate) return shown(`${left} ${NOTE_ERASE_HINT}`, "critical");
  if (sale.companyUuid !== null) return shown(`${left} Touchez « Créer le bon de livraison » pour réessayer : l’app supprime d’abord ce client.`, "critical", true);
  if (order.tooLate) return shown(NOTE_TOO_LATE, "info");
  return shown("Le bon de livraison n’a pas pu être fait. Touchez « Créer le bon de livraison » pour réessayer et voir pourquoi.", "critical", true);
}

export function saleNoteView(sale: AbaNinjaSale | null, order: SaleNoteOrder, now: Date): SaleNoteView | null {
  if (sale === null) return noNoteYet(order);
  switch (sale.noteState) {
    case "en_cours":
      return stillFresh(sale.createdAt, now) ? shown("Bon de livraison en cours dans AbaNinja…", "info") : toCheck(sale);
    case "cree":
      return invoiceDoubt(sale, now) ?? madeNote(sale);
    case "converti":
      return invoiceDoubt(sale, now) ?? converted(sale);
    case "refuse":
      return refusedNote(sale, order);
    case "annule":
      return shown("Bon de livraison annulé dans AbaNinja.", "info");
    default:
      return toCheck(sale);
  }
}

function answer(ok: boolean, message: string): SaleNoteActionResult {
  return { intent: SALE_NOTE_INTENT, ok, message: frenchTypography(message) };
}

export function saleNoteActionResult(outcome: SaleNoteOutcome): SaleNoteActionResult {
  switch (outcome.kind) {
    case "cree":
      return answer(true, outcome.noteNumber === null ? "Bon de livraison fait dans AbaNinja." : `Bon de livraison n° ${outcome.noteNumber} fait dans AbaNinja.`);
    case "deja_fait":
      return answer(true, "Cette commande a déjà son bon de livraison.");
    case "pas_concernee":
      return answer(false, "Seules les commandes d’essai (étiquette « fictif ») ont un bon dans AbaNinja pour l’instant.");
    default:
      return answer(false, outcome.message);
  }
}
