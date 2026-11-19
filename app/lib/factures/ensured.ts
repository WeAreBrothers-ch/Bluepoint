import type { Invoice } from "./repository.server";

/** Facture prête pour une commande : celle qu'on vient de faire, ou celle qui existait déjà. */
export interface EnsuredInvoice {
  readonly invoice: Invoice;
  readonly created: boolean;
  /** Faite dans AbaNinja (commande d'essai) : l'app n'en garde qu'une copie pour l'envoyer. */
  readonly inAbaNinja?: true;
}
