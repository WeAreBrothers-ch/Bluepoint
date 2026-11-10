import type { AbaNinjaInvoice } from "@prisma/client";
import type { InvoiceReadState } from "./invoice-status";

export type { AbaNinjaInvoice };

/** Etats possibles d'une facture AbaNinja (voir le commentaire du modèle dans schema.prisma). */
export type InvoiceState = "en_cours" | "creee" | "incertaine" | "refusee";

/** Ce qu'il reste à supprimer à la main après un essai (code court gardé dans lastErrorCode). */
export const CLEANUP_ISSUE_CODES = ["nettoyage_incomplet", "gardee", "non_brouillon"] as const;
export type CleanupIssueCode = (typeof CLEANUP_ISSUE_CODES)[number];

export interface ClaimInput {
  readonly shop: string;
  readonly orderId: string;
  readonly orderName: string;
  readonly reference: string;
  readonly isTest: boolean;
}

export interface ClaimOutcome {
  readonly invoice: AbaNinjaInvoice;
  /** true seulement pour l'appelant qui a pris le verrou : lui seul a le droit d'envoyer. */
  readonly claimed: boolean;
}

export interface CreatedInvoice {
  readonly invoiceUuid: string;
  readonly systemInvoiceNumber: string;
}

export interface StatusUpdate {
  readonly status: InvoiceReadState;
  readonly openAmountCents: number | null;
}

/** Erreur de base : accès impossible ou verrou déjà pris par une autre ligne. */
export class AbaNinjaRepositoryError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "AbaNinjaRepositoryError";
  }
}

/** Transition refusée : la facture n'est pas dans l'état attendu (ou n'existe pas). */
export class InvalidTransitionError extends AbaNinjaRepositoryError {
  constructor(readonly orderId: string, readonly expected: InvoiceState) {
    super(`Transition refusée : la commande doit être à l'état « ${expected} ».`, "transition_refusee");
    this.name = "InvalidTransitionError";
  }
}
