import type { AbaNinjaSale } from "@prisma/client";
import { frenchTypography } from "./trial-typography";
import type { SaleNoteOutcome } from "./vente-bon.server";

/** Ce que la fiche commande dit du bon de livraison AbaNinja, et la réponse au bouton qui le crée. Logique pure. */

export interface SaleNoteView {
  readonly text: string;
  readonly tone: "success" | "info" | "warning" | "critical";
  /** Afficher « Créer le bon de livraison ». */
  readonly canCreate: boolean;
}

export const SALE_NOTE_INTENT = "bon-creer";

export interface SaleNoteActionResult {
  readonly intent: typeof SALE_NOTE_INTENT;
  readonly ok: boolean;
  readonly message: string;
}

/** Au-delà, un bon « en cours » n'avance plus : la création s'est arrêtée en route. */
const STUCK_AFTER_MS = 2 * 60 * 1000;

export const NOTE_ERASE_HINT =
  "Pour recommencer : page « Connexion AbaNinja », bouton « Effacer les factures d’essai » (il efface aussi les bons), puis « Créer le bon de livraison » sur la commande.";

function shown(text: string, tone: SaleNoteView["tone"], canCreate = false): SaleNoteView {
  return { text: frenchTypography(text), tone, canCreate };
}

function toCheck(sale: AbaNinjaSale): SaleNoteView {
  return shown(`Bon de livraison à vérifier dans AbaNinja (référence ${sale.reference}). ${NOTE_ERASE_HINT}`, "warning");
}

function converted(sale: AbaNinjaSale): SaleNoteView {
  const note = sale.noteNumber === null ? "Bon de livraison" : `Bon de livraison n° ${sale.noteNumber}`;
  const invoice = sale.invoiceNumber === null ? "facture" : `facture ${sale.invoiceNumber}`;
  return shown(`${note} réglé : ${invoice} faite dans AbaNinja.`, "success");
}

export function saleNoteView(sale: AbaNinjaSale | null, isTest: boolean, now: Date): SaleNoteView | null {
  if (sale === null) return isTest ? shown("Pas encore de bon de livraison dans AbaNinja. Touchez « Créer le bon de livraison » : s’il ne peut pas se faire, l’app dit pourquoi.", "info", true) : null;
  switch (sale.noteState) {
    case "en_cours":
      return now.getTime() - sale.createdAt.getTime() < STUCK_AFTER_MS ? shown("Bon de livraison en cours dans AbaNinja…", "info") : toCheck(sale);
    case "cree":
      return sale.noteNumber === null
        ? shown(`Bon de livraison fait dans AbaNinja (référence ${sale.reference}).`, "success")
        : shown(`Bon de livraison n° ${sale.noteNumber} dans AbaNinja.`, "success");
    case "converti":
      return converted(sale);
    case "refuse":
      return shown("Le bon de livraison n’a pas pu être fait. Touchez « Créer le bon de livraison » pour réessayer et voir pourquoi.", "critical", true);
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
